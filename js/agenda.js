// ===== Agenda de Missões - Sistema de Alertas =====

const HOJE = new Date();
HOJE.setHours(0, 0, 0, 0);

let todasMissoes = [];
let missoesFiltradas = [];
let filtrosAtivos = {
  busca: '',
  classe: '',
  responsavel: '',
  status: '',
  alerta: ''
};

// ===== Normalização de dados =====

function normalizarData(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + 'T00:00:00');
  const meses = {
    'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
  };
  const m = str.match(/(\d{1,2})\s*([a-z]{3})\.?\s*(\d{2,4})/i);
  if (m) {
    const dia = parseInt(m[1]);
    const mes = meses[m[2].toLowerCase()];
    let ano = parseInt(m[3]);
    if (ano < 100) ano += 2000;
    if (mes !== undefined) return new Date(ano, mes, dia);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function diasRestantes(deadline) {
  const d = normalizarData(deadline);
  if (!d) return null;
  const diff = d.getTime() - HOJE.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function classificarAlerta(missao) {
  if (missao.status === 'RESOLVIDO') return 'resolvido';
  const dr = diasRestantes(missao.deadline);
  if (dr === null) return 'sem-prazo';
  if (dr < 0) return 'vencida';
  if (dr <= 7) return 'urgente';
  if (dr <= 30) return 'proximo';
  return 'em-dia';
}

function labelAlerta(tipo) {
  const labels = {
    'vencida': 'VENCIDA',
    'urgente': 'ATÉ 7 DIAS',
    'proximo': 'ATÉ 30 DIAS',
    'em-dia': 'EM DIA',
    'resolvido': 'RESOLVIDO',
    'sem-prazo': 'S/ PRAZO'
  };
  return labels[tipo] || tipo;
}

function corAlerta(tipo) {
  const cores = {
    'vencida': '#ef4444',
    'urgente': '#f97316',
    'proximo': '#eab308',
    'em-dia': '#22c55e',
    'resolvido': '#6b7280',
    'sem-prazo': '#8b5cf6'
  };
  return cores[tipo] || '#6b7280';
}

function bgAlerta(tipo) {
  const bgs = {
    'vencida': 'rgba(239,68,68,0.12)',
    'urgente': 'rgba(249,115,22,0.12)',
    'proximo': 'rgba(234,179,8,0.12)',
    'em-dia': 'rgba(34,197,94,0.12)',
    'resolvido': 'rgba(107,114,128,0.12)',
    'sem-prazo': 'rgba(139,92,246,0.12)'
  };
  return bgs[tipo] || 'rgba(107,114,128,0.12)';
}

// ===== Carregamento e processamento =====

function carregarMissoes() {
  if (typeof MISSIONS_DATA === 'undefined') {
    console.error('MISSIONS_DATA não encontrado');
    return;
  }
  todasMissoes = MISSIONS_DATA.map(function(m) {
    const alerta = classificarAlerta(m);
    const dr = diasRestantes(m.deadline);
    return { ...m, alerta: alerta, diasRestantes: dr };
  });
  missoesFiltradas = [...todasMissoes];
}

// ===== Resumo / KPIs =====

function calcularResumo() {
  const resumo = {
    total: 0,
    vencidas: 0,
    urgentes: 0,
    proximas: 0,
    emDia: 0,
    resolvidas: 0,
    semPrazo: 0
  };
  todasMissoes.forEach(function(m) {
    resumo.total++;
    if (m.alerta === 'vencida') resumo.vencidas++;
    else if (m.alerta === 'urgente') resumo.urgentes++;
    else if (m.alerta === 'proximo') resumo.proximas++;
    else if (m.alerta === 'em-dia') resumo.emDia++;
    else if (m.alerta === 'resolvido') resumo.resolvidas++;
    else if (m.alerta === 'sem-prazo') resumo.semPrazo++;
  });
  return resumo;
}

function renderizarResumo() {
  const r = calcularResumo();
  const pendentes = r.vencidas + r.urgentes + r.proximas + r.emDia + r.semPrazo;

  document.getElementById('totalMissoes').textContent = r.total;
  document.getElementById('totalPendentes').textContent = pendentes;
  document.getElementById('totalVencidas').textContent = r.vencidas;
  document.getElementById('totalUrgentes').textContent = r.urgentes;
  document.getElementById('totalResolvidas').textContent = r.resolvidas;

  const indicador = document.getElementById('indicadorAlerta');
  if (r.vencidas > 0) {
    indicador.style.background = 'rgba(239,68,68,0.15)';
    indicador.style.borderColor = '#ef4444';
    indicador.innerHTML = '<span style="color:#ef4444;font-size:28px;font-weight:800;">' + r.vencidas + '</span><span style="color:#ef4444;font-size:12px;font-weight:600;"> MISSÕES VENCIDAS</span>';
  } else if (r.urgentes > 0) {
    indicador.style.background = 'rgba(249,115,22,0.15)';
    indicador.style.borderColor = '#f97316';
    indicador.innerHTML = '<span style="color:#f97316;font-size:28px;font-weight:800;">' + r.urgentes + '</span><span style="color:#f97316;font-size:12px;font-weight:600;"> MISSÕES URGENTES</span>';
  } else {
    indicador.style.background = 'rgba(34,197,94,0.15)';
    indicador.style.borderColor = '#22c55e';
    indicador.innerHTML = '<span style="color:#22c55e;font-size:14px;font-weight:700;">NENHUMA MISSÃO URGENTE</span>';
  }
}

// ===== Filtros =====

function obterClasses() {
  const classes = new Set();
  todasMissoes.forEach(function(m) {
    if (m.class && m.class !== '-') classes.add(m.class);
  });
  return Array.from(classes).sort();
}

function obterResponsaveis() {
  const resps = new Set();
  todasMissoes.forEach(function(m) {
    if (m.responsavel) resps.add(m.responsavel);
  });
  return Array.from(resps).sort();
}

function popularFiltros() {
  const selClasse = document.getElementById('filtroClasse');
  const selResp = document.getElementById('filtroResponsavel');

  obterClasses().forEach(function(c) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    selClasse.appendChild(opt);
  });

  obterResponsaveis().forEach(function(r) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    selResp.appendChild(opt);
  });
}

function aplicarFiltros() {
  filtrosAtivos.busca = document.getElementById('filtroBusca').value.toLowerCase().trim();
  filtrosAtivos.classe = document.getElementById('filtroClasse').value;
  filtrosAtivos.responsavel = document.getElementById('filtroResponsavel').value;
  filtrosAtivos.status = document.getElementById('filtroStatus').value;
  filtrosAtivos.alerta = document.getElementById('filtroAlerta').value;

  missoesFiltradas = todasMissoes.filter(function(m) {
    if (filtrosAtivos.busca) {
      const texto = ((m.id || '') + ' ' + (m.event || '') + ' ' + (m.notes || '')).toLowerCase();
      if (texto.indexOf(filtrosAtivos.busca) === -1) return false;
    }
    if (filtrosAtivos.classe && m.class !== filtrosAtivos.classe) return false;
    if (filtrosAtivos.responsavel && m.responsavel !== filtrosAtivos.responsavel) return false;
    if (filtrosAtivos.status && m.status !== filtrosAtivos.status) return false;
    if (filtrosAtivos.alerta && m.alerta !== filtrosAtivos.alerta) return false;
    return true;
  });

  // Ordenação: data atual primeiro, depois as mais antigas
  missoesFiltradas.sort(function(a, b) {
    const da = normalizarData(a.deadline);
    const db = normalizarData(b.deadline);
    const ta = da ? da.getTime() : -99999999999999;
    const tb = db ? db.getTime() : -99999999999999;
    return tb - ta;
  });

  renderizarTabela();
  document.getElementById('countResultados').textContent = missoesFiltradas.length + ' resultado(s)';
}

// ===== Tabela =====

function renderizarTabela() {
  const tbody = document.getElementById('tabelaMissoesBody');

  if (missoesFiltradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">Nenhuma missão encontrada com os filtros selecionados.</td></tr>';
    return;
  }

  tbody.innerHTML = missoesFiltradas.map(function(m, idx) {
    const cor = corAlerta(m.alerta);
    const bg = bgAlerta(m.alerta);
    const label = labelAlerta(m.alerta);
    const dr = m.diasRestantes;
    let prazoTexto = '-';
    if (dr !== null) {
      if (m.alerta === 'resolvido') {
        prazoTexto = m.deadline || '-';
      } else if (dr < 0) {
        prazoTexto = Math.abs(dr) + 'd atrasado';
      } else if (dr === 0) {
        prazoTexto = 'HOJE';
      } else {
        prazoTexto = dr + 'd restante(s)';
      }
    }

    const diex = m.id || '-';
    const evento = m.event || '-';
    const resp = m.responsavel || '-';
    const classe = m.class || '-';
    const status = m.status || '-';

    return '<tr class="missao-row missao-' + m.alerta + '" onclick="abrirDetalhes(' + idx + ')" style="cursor:pointer;">' +
      '<td><span class="alerta-badge" style="background:' + bg + ';color:' + cor + ';border:1px solid ' + cor + '33;">' + label + '</span></td>' +
      '<td style="max-width:120px;"><span class="diex-numero" title="' + diex + '">' + truncar(diex, 40) + '</span></td>' +
      '<td><span class="evento-texto" title="' + escapeHtml(evento) + '">' + truncar(evento, 80) + '</span></td>' +
      '<td style="text-align:center;font-weight:700;color:' + cor + ';">' + prazoTexto + '</td>' +
      '<td>' + resp + '</td>' +
      '<td><span class="classe-tag">' + classe + '</span></td>' +
      '<td><span class="status-tag status-' + status.toLowerCase().replace(/\s+/g, '-') + '">' + status + '</span></td>' +
    '</tr>';
  }).join('');
}

function truncar(texto, max) {
  if (!texto) return '-';
  texto = texto.replace(/\n/g, ' ').trim();
  return texto.length > max ? texto.substring(0, max) + '...' : texto;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Detalhes da missão (modal) =====

function abrirDetalhes(idx) {
  const m = missoesFiltradas[idx];
  if (!m) return;

  const modal = document.getElementById('modalDetalhes');
  const cor = corAlerta(m.alerta);

  document.getElementById('modalTitulo').innerHTML =
    '<span style="color:' + cor + ';font-weight:700;">' + labelAlerta(m.alerta) + '</span> — ' + (m.id || 'Sem DIEx');

  let html = '<div class="modal-campo"><strong>Evento/Missão:</strong><p>' + (m.event || '-') + '</p></div>';
  html += '<div class="modal-campo"><strong>Prazo:</strong><p>' + (m.deadline || '-') + '</p></div>';
  html += '<div class="modal-campo"><strong>Responsável:</strong><p>' + (m.responsavel || '-') + '</p></div>';
  html += '<div class="modal-campo"><strong>Classe:</strong><p>' + (m.class || '-') + '</p></div>';
  html += '<div class="modal-campo"><strong>Situação:</strong><p>' + (m.status || '-') + '</p></div>';

  if (m.notes) {
    html += '<div class="modal-campo"><strong>Anotações:</strong><p style="white-space:pre-wrap;font-size:13px;line-height:1.5;">' + m.notes + '</p></div>';
  }
  if (m.omds) {
    html += '<div class="modal-campo"><strong>DIEx OMDS:</strong><p style="font-size:12px;">' + m.omds + '</p></div>';
  }
  if (m.escSup) {
    html += '<div class="modal-campo"><strong>DIEx Esc Sup:</strong><p style="font-size:12px;">' + m.escSup + '</p></div>';
  }

  document.getElementById('modalCorpo').innerHTML = html;
  modal.style.display = 'flex';
}

function fecharDetalhes() {
  document.getElementById('modalDetalhes').style.display = 'none';
}

// ===== Inicialização =====

function inicializarAgenda() {
  carregarMissoes();
  popularFiltros();
  renderizarResumo();
  renderizarTabela();
  document.getElementById('countResultados').textContent = missoesFiltradas.length + ' resultado(s)';

  document.getElementById('filtroBusca').addEventListener('input', aplicarFiltros);
  document.getElementById('filtroClasse').addEventListener('change', aplicarFiltros);
  document.getElementById('filtroResponsavel').addEventListener('change', aplicarFiltros);
  document.getElementById('filtroStatus').addEventListener('change', aplicarFiltros);
  document.getElementById('filtroAlerta').addEventListener('change', aplicarFiltros);

  document.getElementById('btnLimparFiltros').addEventListener('click', function() {
    document.getElementById('filtroBusca').value = '';
    document.getElementById('filtroClasse').value = '';
    document.getElementById('filtroResponsavel').value = '';
    document.getElementById('filtroStatus').value = '';
    document.getElementById('filtroAlerta').value = '';
    aplicarFiltros();
  });

  // Fechar modal ao clicar fora
  document.getElementById('modalDetalhes').addEventListener('click', function(e) {
    if (e.target === this) fecharDetalhes();
  });

  // Fechar com ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') fecharDetalhes();
  });
}

document.addEventListener('DOMContentLoaded', inicializarAgenda);
