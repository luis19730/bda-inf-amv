#!/usr/bin/env node
// ===== WhatsApp Sender - Lembrete Diário de Missões =====
// Uso: node whatsapp-sender.js
// Requer: npm install twilio (ou configurar outra API)

const fs = require('fs');
const path = require('path');

// ===== Configuração =====
const CONFIG = {
  // Telefone do destinatário (formato internacional)
  telefone: '5512988843234',

  // Twilio (obter em https://www.twilio.com)
  // Alternativas: Evolution API, Baileys, Z-API
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'SEU_ACCOUNT_SID',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'SEU_AUTH_TOKEN',
    from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'
  },

  // Horário de envio (horário de Brasília)
  horarioEnvio: '08:00',

  // Caminho do arquivo de dados
  dataFile: path.join(__dirname, 'data.v3.json'),
  missionsFile: path.join(__dirname, 'missions_data.js')
};

// ===== Normalização de datas =====
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

// ===== Carregar missões =====
function carregarMissoes() {
  try {
    // Tenta carregar do missions_data.js
    const content = fs.readFileSync(CONFIG.missionsFile, 'utf8');
    const match = content.match(/const MISSIONS_DATA\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      return eval(match[1]);
    }
  } catch (e) {
    console.log('Erro ao carregar missions_data.js:', e.message);
  }
  return [];
}

// ===== Filtrar missões dos próximos 2 dias =====
function obterMissoesProximos2Dias(missoes) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const depois = new Date(hoje);
  depois.setDate(depois.getDate() + 2);

  return missoes.filter(m => {
    if (m.status === 'RESOLVIDO') return false;
    const d = normalizarData(m.deadline);
    if (!d) return false;
    return d >= hoje && d <= depois;
  }).map(m => {
    const d = normalizarData(m.deadline);
    const diff = Math.ceil((d - hoje) / (1000 * 60 * 60 * 24));
    let prazoLabel;
    if (diff === 0) prazoLabel = 'HOJE';
    else if (diff === 1) prazoLabel = 'AMANHÃ';
    else prazoLabel = 'EM ' + diff + ' DIAS';
    return { ...m, prazoLabel, diasRestantes: diff };
  }).sort((a, b) => a.diasRestantes - b.diasRestantes);
}

// ===== Filtrar missões vencidas =====
function obterMissoesVencidas(missoes) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return missoes.filter(m => {
    if (m.status === 'RESOLVIDO') return false;
    const d = normalizarData(m.deadline);
    if (!d) return false;
    return d < hoje;
  });
}

// ===== Formatar mensagem =====
function formatarMensagem(proximas, vencidas) {
  const hoje = new Date();
  const dataStr = hoje.getDate() + '/' + (hoje.getMonth() + 1) + '/' + hoje.getFullYear();

  let msg = '🔔 *LEMBRETE DIÁRIO - BDA INF AMV*';
  msg += '\n📅 ' + dataStr;
  msg += '\n━━━━━━━━━━━━━━━━━━━━';

  if (vencidas.length > 0) {
    msg += '\n\n⚠️ *MISSÕES VENCIDAS (' + vencidas.length + '):*';
    vencidas.forEach((m, i) => {
      msg += '\n\n' + (i + 1) + '. ' + (m.event || 'Sem descrição');
      msg += '\n   📋 DIEx: ' + (m.id || 'N/I');
      msg += '\n   👤 Resp: ' + (m.responsavel || 'N/I');
      msg += '\n   ⏰ Prazo: ' + (m.deadline || 'N/I') + ' (ATRASADO)';
    });
  }

  if (proximas.length > 0) {
    msg += '\n\n📅 *MISSÕES DOS PRÓXIMOS 2 DIAS (' + proximas.length + '):*';
    proximas.forEach((m, i) => {
      msg += '\n\n' + (i + 1) + '. ' + (m.event || 'Sem descrição');
      msg += '\n   📋 DIEx: ' + (m.id || 'N/I');
      msg += '\n   👤 Resp: ' + (m.responsavel || 'N/I');
      msg += '\n   ⏰ Prazo: ' + (m.deadline || 'N/I') + ' (' + m.prazoLabel + ')';
      msg += '\n   📁 Classe: ' + (m.class || 'N/I');
    });
  }

  if (vencidas.length === 0 && proximas.length === 0) {
    msg += '\n\n✅ Nenhuma missão urgente ou vencida nos próximos 2 dias.';
  }

  msg += '\n\n━━━━━━━━━━━━━━━━━━━━';
  msg += '\n💻 Sistema de Gerenciamento - Bda Inf Amv';

  return msg;
}

// ===== Enviar via Twilio =====
async function enviarTwilio(mensagem) {
  try {
    const twilio = require('twilio');
    const client = twilio(CONFIG.twilio.accountSid, CONFIG.twilio.authToken);

    const result = await client.messages.create({
      from: CONFIG.twilio.from,
      to: 'whatsapp:+55' + CONFIG.telefone,
      body: mensagem
    });

    console.log('✅ Mensagem enviada com sucesso!');
    console.log('   SID:', result.sid);
    console.log('   Status:', result.status);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar via Twilio:', error.message);
    return false;
  }
}

// ===== Enviar via API genérica =====
async function enviarAPIGenerica(mensagem) {
  // Configurar sua API aqui
  const API_URL = process.env.WHATSAPP_API_URL || '';
  const API_KEY = process.env.WHATSAPP_API_KEY || '';

  if (!API_URL) {
    console.log('⚠️  API não configurada. Configure WHATSAPP_API_URL e WHATSAPP_API_KEY');
    console.log('   Alternativas:');
    console.log('   - Twilio: npm install twilio');
    console.log('   - Z-API: https://z-api.io');
    console.log('   - Evolution API: https://docs.evolution-api.com');
    console.log('   - Baileys: https://github.com/WhiskeySockets/Baileys');
    return false;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        phone: CONFIG.telefone,
        message: mensagem
      })
    });

    if (response.ok) {
      console.log('✅ Mensagem enviada com sucesso!');
      return true;
    } else {
      console.error('❌ Erro na API:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao enviar:', error.message);
    return false;
  }
}

// ===== Main =====
async function main() {
  console.log('🔔 Iniciando lembrete diário de missões...\n');

  const missoes = carregarMissoes();
  console.log('📋 Total de missões carregadas:', missoes.length);

  const proximas = obterMissoesProximos2Dias(missoes);
  const vencidas = obterMissoesVencidas(missoes);

  console.log('📅 Missões dos próximos 2 dias:', proximas.length);
  console.log('⚠️  Missões vencidas:', vencidas.length);

  const mensagem = formatarMensagem(proximas, vencidas);

  console.log('\n📝 Mensagem formatada:');
  console.log('─'.repeat(40));
  console.log(mensagem);
  console.log('─'.repeat(40));

  // Tentar enviar
  let enviou = false;

  // 1. Tentar Twilio
  if (CONFIG.twilio.accountSid !== 'SEU_ACCOUNT_SID') {
    enviou = await enviarTwilio(mensagem);
  }

  // 2. Tentar API genérica
  if (!enviou && process.env.WHATSAPP_API_URL) {
    enviou = await enviarAPIGenerica(mensagem);
  }

  // 3. Se não enviou, salvar em arquivo
  if (!enviou) {
    const outputFile = path.join(__dirname, 'whatsapp-message-' + new Date().toISOString().split('T')[0] + '.txt');
    fs.writeFileSync(outputFile, mensagem, 'utf8');
    console.log('\n📄 Mensagem salva em:', outputFile);
    console.log('   Para enviar manualmente, copie o conteúdo e envie via WhatsApp.');
  }

  console.log('\n✅ Processo concluído!');
}

// Executar
main().catch(console.error);
