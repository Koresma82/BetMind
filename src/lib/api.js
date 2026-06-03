import { auth } from './firebase';

async function authHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão não iniciada');
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Análise RÁPIDA (function normal, ≤10s). Devolve a resposta crua da Anthropic.
<<<<<<< HEAD
export async function callFast(prompt, system, { maxTokens = 3000, maxSearches = 2, useWebSearch = true } = {}) {
  const res = await fetch('/.netlify/functions/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system, useWebSearch, maxTokens, maxSearches })
=======
export async function callFast(prompt, system, { maxTokens = 3000, maxSearches = 3 } = {}) {
  const res = await fetch('/.netlify/functions/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system, useWebSearch: true, maxTokens, maxSearches })
>>>>>>> 991199c57d225aefc13d574a27e0c072a1efefdf
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// Dispara a análise PROFUNDA em background (só funciona publicado no Netlify).
// Devolve assim que o pedido é aceite; o resultado aparece no Firestore.
export async function startDeep(date, prompt, system) {
  const res = await fetch('/.netlify/functions/deep-analyze-background', {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ date, prompt, system })
  });
  // Background functions respondem 202 Accepted, normalmente sem corpo.
  if (res.status !== 202 && !res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ao iniciar análise profunda (${res.status})`);
  }
  return { started: true };
}

// Grava a previsão do dia no servidor (para validação automática à meia-noite).
export async function savePrediction(date, prediction) {
  const res = await fetch('/.netlify/functions/save-prediction', {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ date, prediction })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// Dispara a validação manual de um dia específico (botão "validar agora").
export async function validateNow(date) {
  const res = await fetch('/.netlify/functions/validate-now', {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ date })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}
<<<<<<< HEAD

// Descobre que modalidades têm eventos hoje (pesquisa leve, rápida).
export async function discoverCategories() {
  const today = new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];
  const prompt = `Hoje é ${today} (${todayISO}). Lista as MODALIDADES desportivas com eventos/jogos AGENDADOS para hoje e quantos eventos relevantes existem em cada. Sê breve. Responde APENAS com JSON:
{"categorias":[{"modalidade":"Futebol","eventos":12,"destaques":"Liga Portugal, Premier League"},{"modalidade":"Ténis","eventos":4,"destaques":"ATP Roland Garros"}]}
Inclui só modalidades com eventos hoje. Se não tiveres a certeza, usa o teu conhecimento dos calendários típicos para este dia da semana e época.`;
  const data = await callFast(prompt, 'Devolves SEMPRE e APENAS JSON válido, a começar por "{". Sem texto à volta, sem desculpas.', { maxTokens: 1200, useWebSearch: false });
  return data;
}

// Validação manual de TODAS as apostas pendentes (botão).
export async function validateBetsNow() {
  const res = await fetch('/.netlify/functions/validate-bets-now', {
    method: 'POST',
    headers: await authHeader(),
    body: '{}'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}
=======
>>>>>>> 991199c57d225aefc13d574a27e0c072a1efefdf
