// Modo estático - substitui chamadas API por dados locais
window.MODO_ESTATICO = true;

let dadosBanco = null;
let versaoLocalStorage = null;

async function carregarDados() {
  if (!dadosBanco) {
    const res = await fetch('data.v3.json?_=' + Date.now());
    dadosBanco = await res.json();
    try {
      const saved = localStorage.getItem('vtr_composicao');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.version && parsed.version >= dadosBanco.version) {
          dadosBanco.composicao_frota = parsed.dados;
        }
      }
    } catch(e) { console.warn('localStorage read error', e); }
  }
  return dadosBanco;
}

// Sobrescreve fetch para /api/* com funções locais
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    return apiLocal(url, options);
  }
  return originalFetch(url, options);
};

async function apiLocal(url, options) {
  const db = await carregarDados();
  let data = null;
  let status = 200;

  const match = url.match(/^\/api\/(\w+)(?:\/(\d+))?(?:\/(\w+))?/);
  if (!match) return responder({ erro: 'rota invalida' }, 404);

  const [_, recurso, id, subrecurso] = match;

  if (recurso === 'dashboard') {
    const comp = db.composicao_frota || {};
    let total = 0, prontas = 0;
    Object.values(comp).forEach(function(omComp) {
      Object.values(omComp).forEach(function(t) {
        total += t.total || 0;
        prontas += (t.total || 0) - (t.indisponiveis || 0);
      });
    });
    data = { total_frota: total, vtr_prontas: prontas, em_manutencao_organica: 0, em_manutencao_externa: 0, restricao: 0, indice_geral: total > 0 ? parseFloat(((prontas / total) * 100).toFixed(1)) : 0 };
  }

  else if (recurso === 'composicao' && !id) {
    if (options && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (!db.composicao_frota) db.composicao_frota = {};
      if (!db.composicao_frota[body.om_id]) db.composicao_frota[body.om_id] = {};
      Object.assign(db.composicao_frota[body.om_id], body.dados);
      salvarDados(db);
      data = { sucesso: true, mensagem: 'Composicao salva' };
    } else {
      const params = new URLSearchParams(url.split('?')[1] || '');
      const omId = params.get('om_id');
      if (omId) {
        data = db.composicao_frota && db.composicao_frota[omId] ? db.composicao_frota[omId] : {};
      } else {
        data = db.composicao_frota || {};
      }
    }
  }

  else if (recurso === 'oms' && subrecurso === 'status') {
    data = db.oms.map(om => {
      const comp = (db.composicao_frota || {})[String(om.id)] || {};
      let total = 0, prontas = 0;
      Object.values(comp).forEach(function(t) {
        total += t.total || 0;
        prontas += (t.total || 0) - (t.indisponiveis || 0);
      });
      return { ...om, total_frota: total, vtr_prontas: prontas, indice_disponibilidade: total > 0 ? parseFloat(((prontas / total) * 100).toFixed(1)) : 0 };
    });
  }

  else if (recurso === 'oms' && !id) {
    data = db.oms.sort((a, b) => a.sigla.localeCompare(b.sigla));
  }

  else if (recurso === 'viaturas' && !id && url.indexOf('/alertas') === -1) {
    const params = new URLSearchParams(url.split('?')[1] || '');
    let vtrs = db.viaturas.map(v => {
      const sa = db.status_atual.find(s => s.viatura_id === v.id);
      const om = db.oms.find(o => o.id === v.om_id);
      return { ...v, om_sigla: om ? om.sigla : '?', status: sa ? sa.status : 'Sem registro', gargalo: sa ? sa.gargalo : null, observacao: sa ? sa.observacao : null, data_atualizacao: sa ? sa.data_atualizacao : null, km_para_revisao: v.proxima_revisao_km - v.quilometragem_atual };
    });
    if (params.get('om_id')) vtrs = vtrs.filter(v => v.om_id == params.get('om_id'));
    if (params.get('status')) vtrs = vtrs.filter(v => v.status === params.get('status'));
    if (params.get('tipo')) vtrs = vtrs.filter(v => v.tipo_viatura === params.get('tipo'));
    if (params.get('busca')) { const q = params.get('busca').toLowerCase(); vtrs = vtrs.filter(v => (v.placa && v.placa.toLowerCase().includes(q)) || (v.eb_numero && v.eb_numero.toLowerCase().includes(q)) || (v.marca_modelo && v.marca_modelo.toLowerCase().includes(q))); }
    data = vtrs;
  }

  else if (url.indexOf('/alertas') !== -1) {
    data = db.viaturas.filter(v => { const sa = db.status_atual.find(s => s.viatura_id === v.id); const kmRestante = v.proxima_revisao_km - v.quilometragem_atual; return sa && sa.status === 'Pronta' && kmRestante < 500; }).map(v => { const om = db.oms.find(o => o.id === v.om_id); return { ...v, om_sigla: om ? om.sigla : '?', km_para_revisao: v.proxima_revisao_km - v.quilometragem_atual }; }).sort((a, b) => a.km_para_revisao - b.km_para_revisao);
  }

  else if (recurso === 'historico' && id) {
    data = db.historico.filter(h => h.viatura_id == id).sort((a, b) => b.data_registro.localeCompare(a.data_registro)).slice(0, 50);
  }

  else if (recurso === 'viaturas' && id && options && options.method === 'POST' && url.indexOf('/status') === -1) {
    const body = JSON.parse(options.body);
    const maxId = db.viaturas.length > 0 ? Math.max(...db.viaturas.map(v => v.id)) + 1 : 1;
    const now = new Date().toISOString();
    db.viaturas.push({ id: maxId, placa: body.placa, eb_numero: body.eb_numero || null, om_id: parseInt(body.om_id), tipo_viatura: body.tipo_viatura, marca_modelo: body.marca_modelo || null, capacidade: body.capacidade || null, ano_fabricacao: body.ano_fabricacao ? parseInt(body.ano_fabricacao) : null, quilometragem_atual: body.quilometragem_atual ? parseInt(body.quilometragem_atual) : 0, proxima_revisao_km: body.proxima_revisao_km ? parseInt(body.proxima_revisao_km) : null });
    db.status_atual.push({ viatura_id: maxId, status: 'Pronta', gargalo: null, data_atualizacao: now, registrado_por: 'Sistema', observacao: null });
    db.historico.push({ viatura_id: maxId, status: 'Pronta', gargalo: null, data_registro: now, registrado_por: 'Sistema', observacao: null });
    salvarDados(db);
    data = { sucesso: true, id: maxId, mensagem: 'Viatura criada' };
  }

  else if (recurso === 'viaturas' && id && url.indexOf('/status') !== -1 && options && options.method === 'POST') {
    const body = JSON.parse(options.body);
    const now = new Date().toISOString();
    const idx = db.status_atual.findIndex(s => s.viatura_id == id);
    const entry = { viatura_id: parseInt(id), status: body.status, gargalo: body.gargalo || null, data_atualizacao: now, registrado_por: body.registrado_por || 'Usuario', observacao: body.observacao || null };
    if (idx >= 0) db.status_atual[idx] = entry; else db.status_atual.push(entry);
    db.historico.push({ viatura_id: parseInt(id), status: body.status, gargalo: body.gargalo || null, data_registro: now, registrado_por: body.registrado_por || 'Usuario', observacao: body.observacao || null });
    salvarDados(db);
    data = { sucesso: true, mensagem: 'Status atualizado' };
  }

  else if (recurso === 'viaturas' && id && options && options.method === 'PUT') {
    const body = JSON.parse(options.body);
    const idx = db.viaturas.findIndex(v => v.id == id);
    if (idx >= 0) {
      const v = db.viaturas[idx];
      if (body.placa) v.placa = body.placa;
      if (body.eb_numero !== undefined) v.eb_numero = body.eb_numero || null;
      if (body.om_id) v.om_id = parseInt(body.om_id);
      if (body.tipo_viatura) v.tipo_viatura = body.tipo_viatura;
      if (body.marca_modelo !== undefined) v.marca_modelo = body.marca_modelo || null;
      if (body.capacidade !== undefined) v.capacidade = body.capacidade || null;
      if (body.ano_fabricacao !== undefined) v.ano_fabricacao = body.ano_fabricacao ? parseInt(body.ano_fabricacao) : null;
      if (body.quilometragem_atual !== undefined) v.quilometragem_atual = body.quilometragem_atual ? parseInt(body.quilometragem_atual) : 0;
      if (body.proxima_revisao_km !== undefined) v.proxima_revisao_km = body.proxima_revisao_km ? parseInt(body.proxima_revisao_km) : null;
      data = { sucesso: true, mensagem: 'Viatura atualizada' };
      salvarDados(db);
    } else data = { erro: 'Nao encontrada' };
  }

  else if (recurso === 'viaturas' && id && options && options.method === 'DELETE') {
    const idx = db.viaturas.findIndex(v => v.id == id);
    if (idx >= 0) {
      db.viaturas.splice(idx, 1);
      db.status_atual = db.status_atual.filter(s => s.viatura_id != id);
      db.historico = db.historico.filter(h => h.viatura_id != id);
      db.pareto = db.pareto.filter(p => p.viatura_id != id);
      data = { sucesso: true, mensagem: 'Excluida' };
      salvarDados(db);
    } else data = { erro: 'Nao encontrada' };
  }

  else {
    return originalFetch(url, options);
  }

  return responder(data, status);
}

function responder(data, status) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status: status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });
}

function salvarDados(db) {
    try {
      localStorage.setItem('vtr_composicao', JSON.stringify({
        version: db.version || 0,
        dados: db.composicao_frota || {}
      }));
    } catch(e) { console.warn('localStorage write error', e); }
  dadosBanco = db;
}
