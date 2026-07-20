const API = '/api';

function statusClass(status) {
  if (status === 'Pronta') return 'pronta';
  if (status === 'Manutenção Orgânica') return 'mnt-org';
  if (status === 'Manutenção Externa') return 'mnt-ext';
  return 'restricao';
}

function corIndice(indice) {
  if (indice >= 85) return 'verde';
  if (indice >= 70) return 'amarelo';
  return 'vermelho';
}

function atualizarRelogio() {
  const agora = new Date();
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  document.getElementById('dataAtual').textContent = `${dias[agora.getDay()]}, ${agora.getDate()} ${meses[agora.getMonth()]} ${agora.getFullYear()}`;
  document.getElementById('horaAtual').textContent = agora.toLocaleTimeString('pt-BR');
}

function desenharVelocimetro(valor) {
  const canvas = document.getElementById('velocimetroCanvas');
  const ctx = canvas.getContext('2d');
  const cx = 160, cy = 140, r = 110;

  ctx.clearRect(0, 0, 320, 180);

  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.lineWidth = 20;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.stroke();

  const pct = Math.min(valor / 100, 1);
  const valorAngle = startAngle + (pct * Math.PI);

  let cor;
  if (valor >= 85) cor = '#22c55e';
  else if (valor >= 70) cor = '#eab308';
  else cor = '#ef4444';

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valorAngle);
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.strokeStyle = cor;
  ctx.stroke();

  const cores = [
    { ang: startAngle, cor: '#ef4444' },
    { ang: startAngle + Math.PI * 0.35, cor: '#eab308' },
    { ang: startAngle + Math.PI * 0.6, cor: '#22c55e' },
  ];

  for (let i = 0; i < 21; i++) {
    const ang = startAngle + (i / 20) * Math.PI;
    const x1 = cx + (r - 16) * Math.cos(ang);
    const y1 = cy + (r - 16) * Math.sin(ang);
    const x2 = cx + (r - 24) * Math.cos(ang);
    const y2 = cy + (r - 24) * Math.sin(ang);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineCap = 'butt';
    ctx.stroke();
  }
}

async function carregarDashboard() {
  try {
    const [dashRes, omsRes, compRes] = await Promise.all([
      fetch(`${API}/dashboard`),
      fetch(`${API}/oms/status`),
      fetch(`${API}/composicao`),
    ]);

    const dash = await dashRes.json();
    const oms = await omsRes.json();
    const compTotal = await compRes.json();

    document.getElementById('totalFrota').textContent = dash.total_frota;
    document.getElementById('vtrProntas').textContent = dash.vtr_prontas;
    document.getElementById('badgeProntas').textContent = dash.vtr_prontas;

    document.getElementById('indiceGeralValor').textContent = dash.indice_geral + '%';
    desenharVelocimetro(dash.indice_geral);

    const tbodyOm = document.getElementById('tabelaOmBody');
    tbodyOm.innerHTML = oms.map(om => {
      const cor = corIndice(om.indice_disponibilidade);
      const total = om.total_frota;
      return `
        <tr>
          <td style="font-weight:600;">${om.sigla}</td>
          <td>${total}</td>
          <td style="color:var(--green);font-weight:600;">${om.vtr_prontas}</td>
          <td><span class="indice-badge ${cor}">${om.indice_disponibilidade}%</span></td>
          <td>
            <div class="barra-progresso">
              <div class="preenchimento ${cor}" style="width:${om.indice_disponibilidade}%"></div>
            </div>
          </td>
        </tr>`;
    }).join('');

    renderizarDetalhamentoOM(compTotal, oms);
    renderizarGraficoBarras(oms);
    renderizarGraficosPizza(oms);

  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

function renderizarDetalhamentoOM(compTotal, oms) {
  const container = document.getElementById('detalhamentoOmContainer');
  const TIPOS = [
    'VTP 5 Psg', 'VTP Picape 5 Psg', 'VTP Ônibus', 'VTP Micro-ônibus', 'VTP Van 14 a 16 Psg',
    'VTNE ¾ Ton', 'VTNE 5 Ton', 'VTNE 2 ½ Ton',
    'VTE Ambulância', 'VTE Cisterna Água', 'VTE Cisterna Combustível', 'VTE Baú',
    'VTP Motocicleta', 'VSRNE Reboque'
  ];
  container.innerHTML = oms.map(function(om) {
    const omComp = compTotal[String(om.id)];
    if (!omComp) return '';
    const linhas = TIPOS.map(function(tipo) {
      const info = omComp[tipo];
      if (!info || !info.total) return null;
      const total = info.total;
      const indisp = info.indisponiveis || 0;
      const prontas = total - indisp;
      const pct = total > 0 ? ((prontas / total) * 100).toFixed(1) : 0;
      return '<tr>' +
        '<td>' + tipo + '</td>' +
        '<td>' + total + '</td>' +
        '<td style="color:var(--red);font-weight:600;">' + indisp + '</td>' +
        '<td><span class="indice-badge ' + corIndice(parseFloat(pct)) + '">' + pct + '%</span></td>' +
      '</tr>';
    }).filter(Boolean).join('');
    if (!linhas) return '';
    return '<div class="om-card">' +
      '<h3 style="margin:0 0 12px 0;font-size:15px;color:var(--text-primary);">' + om.sigla + '</h3>' +
      '<table class="om-detalhe-tabela">' +
        '<thead><tr>' +
          '<th>Tipo de Vtr</th>' +
          '<th>Total</th>' +
          '<th>Indisponiveis</th>' +
          '<th>% Disponibilidade</th>' +
        '</tr></thead>' +
        '<tbody>' + linhas + '</tbody>' +
      '</table>' +
    '</div>';
  }).filter(Boolean).join('');
}

function renderizarGraficoBarras(oms) {
  const container = document.getElementById('graficoBarras');
  const maxVal = Math.max(...oms.map(function(o) { return o.total_frota; }), 1);
  container.innerHTML = oms.map(function(om) {
    const hProntas = (om.vtr_prontas / maxVal) * 110;
    return '<div class="coluna-om">' +
      '<div class="barra-valor" style="font-weight:700;font-size:13px;text-align:center;color:var(--green);margin-bottom:2px;">' + om.vtr_prontas + '</div>' +
      '<div class="barra-wrapper">' +
        '<div class="barra pronta" style="height:' + hProntas + 'px" title="Disponiveis: ' + om.vtr_prontas + '"></div>' +
      '</div>' +
      '<div class="label-om">' + om.sigla.replace(' Amv', '').replace(' Bda', '') + '</div>' +
    '</div>';
  }).join('');
}

function renderizarGraficosPizza(oms) {
  const container = document.getElementById('pizzaContainer');
  container.innerHTML = oms.map(function(om) {
    var total = om.total_frota || 0;
    var prontas = om.vtr_prontas || 0;
    var indisp = total - prontas;
    if (total === 0) {
      return '<div class="pizza-card">' +
        '<svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/></svg>' +
        '<div class="pizza-nome">' + om.sigla + '</div>' +
      '</div>';
    }
    var pct = ((prontas / total) * 100).toFixed(1);
    var pctIndisp = ((indisp / total) * 100).toFixed(1);
    var circum = 2 * Math.PI * 32;
    var offsetProntas = circum * (1 - prontas / total);
    var offsetIndisp = circum * (1 - (prontas + indisp) / total);
    return '<div class="pizza-card">' +
      '<svg width="80" height="80" viewBox="0 0 80 80">' +
        '<circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>' +
        '<circle cx="40" cy="40" r="32" fill="none" stroke="var(--green)" stroke-width="8" stroke-dasharray="' + circum + '" stroke-dashoffset="' + offsetProntas + '" transform="rotate(-90 40 40)" stroke-linecap="butt"/>' +
        (indisp > 0 ? '<circle cx="40" cy="40" r="32" fill="none" stroke="var(--red)" stroke-width="8" stroke-dasharray="' + circum + '" stroke-dashoffset="' + offsetIndisp + '" transform="rotate(-90 40 40)" stroke-linecap="butt"/>' : '') +
        '<text x="40" y="40" text-anchor="middle" dominant-baseline="central" fill="var(--text-primary)" font-size="14" font-weight="700">' + pct + '%</text>' +
      '</svg>' +
      '<div class="pizza-nome">' + om.sigla + '</div>' +
    '</div>';
  }).join('');
}

atualizarRelogio();
setInterval(atualizarRelogio, 1000);
carregarDashboard();
setInterval(carregarDashboard, 60000);
