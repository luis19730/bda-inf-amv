// ===== WhatsApp - Lembrete Diário de Missões =====

let filtroDias = 2;
let filtroResponsavel = '';
let missoesVisiveis = [];
let selecionadas = new Set();
let contatos = [];
let contatoEditandoIdx = -1;

// ===== Contatos =====

function carregarContatos() {
  try {
    contatos = JSON.parse(localStorage.getItem('whatsapp_contatos') || '[]');
  } catch (e) {
    contatos = [];
  }
  if (contatos.length === 0) {
    contatos = [
      { nome: 'Comandante', telefone: '5512988843234' }
    ];
    salvarContatos();
  }
}

function salvarContatos() {
  localStorage.setItem('whatsapp_contatos', JSON.stringify(contatos));
}

function renderizarContatos() {
  var container = document.getElementById('listaContatos');
  var html = '';
  contatos.forEach(function(c, i) {
    html += '<label class="contato-chip" data-idx="' + i + '">';
    html += '<input type="checkbox" class="check-contato" data-idx="' + i + '"' + (c.selecionado !== false ? ' checked' : '') + '>';
    html += '<span>' + c.nome + '</span>';
    html += '</label>';
  });
  if (contatos.length === 0) {
    html = '<span style="color:var(--text-secondary);font-size:13px;">Nenhum contato cadastrado</span>';
  }
  container.innerHTML = html;

  container.querySelectorAll('.check-contato').forEach(function(cb) {
    cb.addEventListener('change', function() {
      contatos[parseInt(this.dataset.idx)].selecionado = this.checked;
      salvarContatos();
      renderizarMensagemBruta();
    });
  });

  container.querySelectorAll('.contato-chip').forEach(function(chip) {
    chip.addEventListener('dblclick', function() {
      var idx = parseInt(this.dataset.idx);
      abrirModalContatos();
      document.getElementById('contatoNome').value = contatos[idx].nome;
      document.getElementById('contatoTelefone').value = contatos[idx].telefone;
      contatoEditandoIdx = idx;
      document.getElementById('btnSalvarContato').textContent = 'Atualizar';
    });
  });
}

function renderizarContatosModal() {
  var container = document.getElementById('listaContatosModal');
  if (contatos.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px;">Nenhum contato cadastrado</p>';
    return;
  }
  var html = '<table style="width:100%;border-collapse:collapse;">';
  html += '<tr style="border-bottom:1px solid var(--border);">';
  html += '<th style="text-align:left;padding:8px;font-size:12px;color:var(--text-secondary);">Nome</th>';
  html += '<th style="text-align:left;padding:8px;font-size:12px;color:var(--text-secondary);">Telefone</th>';
  html += '<th style="text-align:right;padding:8px;font-size:12px;color:var(--text-secondary);">Ações</th>';
  html += '</tr>';
  contatos.forEach(function(c, i) {
    html += '<tr style="border-bottom:1px solid var(--border);">';
    html += '<td style="padding:8px;font-size:13px;">' + c.nome + '</td>';
    html += '<td style="padding:8px;font-size:13px;color:var(--text-secondary);">' + c.telefone + '</td>';
    html += '<td style="padding:8px;text-align:right;">';
    html += '<button class="btn-editar-contato" data-idx="' + i + '" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:13px;margin-right:8px;">Editar</button>';
    html += '<button class="btn-excluir-contato" data-idx="' + i + '" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;">Excluir</button>';
    html += '</td></tr>';
  });
  html += '</table>';
  container.innerHTML = html;

  container.querySelectorAll('.btn-editar-contato').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      document.getElementById('contatoNome').value = contatos[idx].nome;
      document.getElementById('contatoTelefone').value = contatos[idx].telefone;
      contatoEditandoIdx = idx;
      document.getElementById('btnSalvarContato').textContent = 'Atualizar';
    });
  });

  container.querySelectorAll('.btn-excluir-contato').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      if (confirm('Excluir "' + contatos[idx].nome + '"?')) {
        contatos.splice(idx, 1);
        salvarContatos();
        renderizarContatos();
        renderizarContatosModal();
      }
    });
  });
}

function abrirModalContatos() {
  document.getElementById('modalContatos').style.display = 'flex';
  document.getElementById('contatoNome').value = '';
  document.getElementById('contatoTelefone').value = '';
  contatoEditandoIdx = -1;
  document.getElementById('btnSalvarContato').textContent = 'Salvar';
  renderizarContatosModal();
}

function fecharModalContatos() {
  document.getElementById('modalContatos').style.display = 'none';
}

function salvarContatoForm() {
  var nome = document.getElementById('contatoNome').value.trim();
  var telefone = document.getElementById('contatoTelefone').value.replace(/\D/g, '').trim();
  if (!nome) { alert('Informe o nome do contato.'); return; }
  if (!telefone) { alert('Informe o telefone do contato.'); return; }

  if (contatoEditandoIdx >= 0) {
    contatos[contatoEditandoIdx].nome = nome;
    contatos[contatoEditandoIdx].telefone = telefone;
  } else {
    contatos.push({ nome: nome, telefone: telefone, selecionado: true });
  }

  salvarContatos();
  renderizarContatos();
  renderizarContatosModal();
  document.getElementById('contatoNome').value = '';
  document.getElementById('contatoTelefone').value = '';
  contatoEditandoIdx = -1;
  document.getElementById('btnSalvarContato').textContent = 'Salvar';
}

function obterTelefonesSelecionados() {
  return contatos.filter(function(c) { return c.selecionado !== false; });
}

// ===== Missões =====

function obterMissoesProximosDias() {
  if (typeof MISSIONS_DATA === 'undefined') return [];

  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  var limite = new Date(hoje);
  limite.setDate(limite.getDate() + filtroDias);

  return MISSIONS_DATA.filter(function(m) {
    if (m.status === 'RESOLVIDO') return false;
    if (filtroResponsavel && m.responsavel !== filtroResponsavel) return false;
    var d = normalizarData(m.deadline);
    if (!d) return false;
    return d >= hoje && d <= limite;
  }).map(function(m) {
    var d = normalizarData(m.deadline);
    var diff = Math.ceil((d - hoje) / (1000 * 60 * 60 * 24));
    var prazoLabel;
    if (diff === 0) prazoLabel = 'HOJE';
    else if (diff === 1) prazoLabel = 'AMANHÃ';
    else prazoLabel = 'EM ' + diff + ' DIAS';
    return Object.assign({}, m, { prazoLabel: prazoLabel, diasRestantes: diff });
  }).sort(function(a, b) { return a.diasRestantes - b.diasRestantes; });
}

function obterMissoesVencidas() {
  if (typeof MISSIONS_DATA === 'undefined') return [];
  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return MISSIONS_DATA.filter(function(m) {
    if (m.status === 'RESOLVIDO') return false;
    if (filtroResponsavel && m.responsavel !== filtroResponsavel) return false;
    var d = normalizarData(m.deadline);
    if (!d) return false;
    return d < hoje;
  });
}

function chaveMissao(m) {
  return (m.id || '') + '|' + (m.deadline || '') + '|' + (m.event || '');
}

function toggleSelecionada(chave) {
  if (selecionadas.has(chave)) {
    selecionadas.delete(chave);
  } else {
    selecionadas.add(chave);
  }
  atualizarCheckboxes();
  renderizarMensagemBruta();
}

function toggleTodas(ator) {
  var checks = document.querySelectorAll('.check-missao');
  checks.forEach(function(cb) {
    if (ator === 'marcar') {
      cb.checked = true;
      selecionadas.add(cb.dataset.chave);
    } else {
      cb.checked = false;
      selecionadas.delete(cb.dataset.chave);
    }
  });
  renderizarMensagemBruta();
}

function atualizarCheckboxes() {
  var total = document.querySelectorAll('.check-missao').length;
  var marcadas = document.querySelectorAll('.check-missao:checked').length;
  document.getElementById('countSelecionadas').textContent = marcadas + '/' + total + ' selecionada(s)';
}

function formatarMensagemWhatsApp() {
  var selecionadasLista = missoesVisiveis.filter(function(m) {
    return selecionadas.has(chaveMissao(m));
  });

  var vencidas = selecionadasLista.filter(function(m) {
    var d = normalizarData(m.deadline);
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    return d && d < hoje;
  });

  var proximas = selecionadasLista.filter(function(m) {
    var d = normalizarData(m.deadline);
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    return d && d >= hoje;
  }).sort(function(a, b) { return a.diasRestantes - b.diasRestantes; });

  var hoje = new Date();
  var dataStr = hoje.getDate() + '/' + (hoje.getMonth() + 1) + '/' + hoje.getFullYear();

  var msg = '🔔 *LEMBRETE DIÁRIO - BDA INF AMV*';
  msg += '\n📅 ' + dataStr;
  if (filtroResponsavel) msg += '\n👤 *Responsável: ' + filtroResponsavel + '*';
  msg += '\n━━━━━━━━━━━━━━━━━━━━';

  if (vencidas.length > 0) {
    msg += '\n\n⚠️ *MISSÕES VENCIDAS (' + vencidas.length + '):*';
    vencidas.forEach(function(m, i) {
      msg += '\n\n' + (i + 1) + '. ' + (m.event || 'Sem descrição');
      msg += '\n   📋 DIEx: ' + (m.id || 'N/I');
      msg += '\n   👤 Resp: ' + (m.responsavel || 'N/I');
      msg += '\n   ⏰ Prazo: ' + (m.deadline || 'N/I') + ' (ATRASADO)';
    });
  }

  if (proximas.length > 0) {
    msg += '\n\n📅 *MISSÕES DOS PRÓXIMOS ' + filtroDias + ' DIAS (' + proximas.length + '):*';
    proximas.forEach(function(m, i) {
      msg += '\n\n' + (i + 1) + '. ' + (m.event || 'Sem descrição');
      msg += '\n   📋 DIEx: ' + (m.id || 'N/I');
      msg += '\n   👤 Resp: ' + (m.responsavel || 'N/I');
      msg += '\n   ⏰ Prazo: ' + (m.deadline || 'N/I') + ' (' + m.prazoLabel + ')';
      msg += '\n   📁 Classe: ' + (m.class || 'N/I');
    });
  }

  if (selecionadasLista.length === 0) {
    msg += '\n\n✅ Nenhuma missão selecionada.';
  }

  msg += '\n\n━━━━━━━━━━━━━━━━━━━━';
  msg += '\n💻 Sistema de Gerenciamento - Bda Inf Amv';

  return msg;
}

function enviarWhatsApp() {
  var selecionados = obterTelefonesSelecionados();
  if (selecionados.length === 0) { alert('Selecione pelo menos um contato.'); return; }
  var msg = formatarMensagemWhatsApp();
  var encoded = encodeURIComponent(msg);

  if (selecionados.length === 1) {
    window.open('https://wa.me/' + selecionados[0].telefone + '?text=' + encoded, '_blank');
  } else {
    selecionados.forEach(function(c, i) {
      setTimeout(function() {
        window.open('https://wa.me/' + c.telefone + '?text=' + encoded, '_blank');
      }, i * 500);
    });
  }
}

function copiarMensagem() {
  var msg = formatarMensagemWhatsApp();
  navigator.clipboard.writeText(msg).then(function() {
    var btn = document.getElementById('btnCopiar');
    var original = btn.textContent;
    btn.textContent = '✓ Copiado!';
    btn.style.background = 'var(--green)';
    setTimeout(function() {
      btn.textContent = original;
      btn.style.background = '';
    }, 2000);
  });
}

function renderizarPreviewDiario() {
  var container = document.getElementById('previewContainer');
  var proximas = obterMissoesProximosDias();
  var vencidas = obterMissoesVencidas();

  missoesVisiveis = [];
  selecionadas = new Set();

  var html = '<div class="preview-selecao">';
  html += '<button class="btn btn-secondary" onclick="toggleTodas(\'marcar\')" style="font-size:11px;padding:5px 12px;">Marcar Todas</button>';
  html += '<button class="btn btn-secondary" onclick="toggleTodas(\'desmarcar\')" style="font-size:11px;padding:5px 12px;">Desmarcar Todas</button>';
  html += '<span id="countSelecionadas" style="font-size:12px;color:var(--text-secondary);"></span>';
  html += '</div>';

  if (vencidas.length > 0) {
    html += '<div class="preview-secao preview-vencidas">';
    html += '<h3>⚠️ Missões Vencidas (' + vencidas.length + ')</h3>';
    vencidas.forEach(function(m) {
      var chave = chaveMissao(m);
      missoesVisiveis.push(m);
      selecionadas.add(chave);
      html += '<div class="preview-item item-vencido">';
      html += '<label class="preview-check"><input type="checkbox" class="check-missao" data-chave="' + chave + '" checked onchange="toggleSelecionada(this.dataset.chave)"></label>';
      html += '<div class="preview-conteudo">';
      html += '<div class="preview-titulo">' + (m.event || 'Sem descrição') + '</div>';
      html += '<div class="preview-detalhes">';
      html += '<span>📋 ' + (m.id || 'N/I') + '</span>';
      html += '<span>👤 ' + (m.responsavel || 'N/I') + '</span>';
      html += '<span>⏰ ' + (m.deadline || 'N/I') + '</span>';
      html += '</div></div></div>';
    });
    html += '</div>';
  }

  if (proximas.length > 0) {
    html += '<div class="preview-secao preview-proximas">';
    html += '<h3>📅 Próximos ' + filtroDias + ' Dias (' + proximas.length + ')</h3>';
    proximas.forEach(function(m) {
      var chave = chaveMissao(m);
      missoesVisiveis.push(m);
      selecionadas.add(chave);
      var corClasse = m.diasRestantes === 0 ? '#ef4444' : m.diasRestantes <= 2 ? '#f97316' : '#eab308';
      html += '<div class="preview-item item-proximo">';
      html += '<label class="preview-check"><input type="checkbox" class="check-missao" data-chave="' + chave + '" checked onchange="toggleSelecionada(this.dataset.chave)"></label>';
      html += '<div class="preview-conteudo">';
      html += '<div class="preview-badge" style="background:' + corClasse + ';">' + m.prazoLabel + '</div>';
      html += '<div class="preview-titulo">' + (m.event || 'Sem descrição') + '</div>';
      html += '<div class="preview-detalhes">';
      html += '<span>📋 ' + (m.id || 'N/I') + '</span>';
      html += '<span>👤 ' + (m.responsavel || 'N/I') + '</span>';
      html += '<span>📁 ' + (m.class || 'N/I') + '</span>';
      html += '</div></div></div>';
    });
    html += '</div>';
  }

  if (vencidas.length === 0 && proximas.length === 0) {
    html = '<div class="preview-secao preview-ok">';
    html += '<h3>✅ Tudo em dia!</h3>';
    html += '<p>Nenhuma missão urgente ou vencida nos próximos ' + filtroDias + ' dias.</p>';
    html += '</div>';
  }

  container.innerHTML = html;
  atualizarCheckboxes();
}

function renderizarMensagemBruta() {
  var msg = formatarMensagemWhatsApp();
  document.getElementById('mensagemBruta').textContent = msg;
}

function atualizarTudo() {
  filtroDias = parseInt(document.getElementById('filtroDias').value) || 2;
  filtroResponsavel = document.getElementById('filtroResponsavel').value;
  renderizarPreviewDiario();
  renderizarMensagemBruta();
}

function popularResponsaveis() {
  if (typeof MISSIONS_DATA === 'undefined') return;
  var sel = document.getElementById('filtroResponsavel');
  var resps = new Set();
  MISSIONS_DATA.forEach(function(m) {
    if (m.responsavel) resps.add(m.responsavel);
  });
  Array.from(resps).sort().forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    sel.appendChild(opt);
  });
}

function inicializarWhatsApp() {
  carregarContatos();
  popularResponsaveis();
  renderizarContatos();
  renderizarPreviewDiario();
  renderizarMensagemBruta();

  document.getElementById('btnEnviar').addEventListener('click', enviarWhatsApp);
  document.getElementById('btnCopiar').addEventListener('click', copiarMensagem);
  document.getElementById('filtroDias').addEventListener('change', atualizarTudo);
  document.getElementById('filtroResponsavel').addEventListener('change', atualizarTudo);
  document.getElementById('btnGerenciarContatos').addEventListener('click', abrirModalContatos);
  document.getElementById('btnSalvarContato').addEventListener('click', salvarContatoForm);

  document.getElementById('modalContatos').addEventListener('click', function(e) {
    if (e.target === this) fecharModalContatos();
  });

  var agora = new Date();
  document.getElementById('dataAtual').textContent = agora.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  document.getElementById('horaAtual').textContent = agora.toLocaleTimeString('pt-BR');
}

document.addEventListener('DOMContentLoaded', inicializarWhatsApp);
