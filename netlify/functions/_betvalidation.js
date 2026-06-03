// Lógica partilhada de validação das APOSTAS do utilizador.
const { listBets, updateBetStatus } = require('./_listbets');
const { extractJSON } = require('./_validation');

async function askResults(pendingBets) {
  const lista = pendingBets.map(b => ({ id: b.id, jogo: b.match, mercado: b.market, modalidade: b.sport, data: b.eventDate }));
  const prompt = `Estás a validar apostas desportivas já realizadas. Pesquisa os RESULTADOS REAIS de cada uma.
Para cada aposta decide: "won" (ganhou), "lost" (perdeu), "void" (anulada/adiada/sem resultado), ou "pending" (ainda não jogou / sem dados).
Apostas (JSON):
${JSON.stringify(lista)}
Responde APENAS com JSON válido, sem markdown:
{"resultados":[{"id":"<id>","resultado_real":"2-1","status":"won"}]}
Inclui TODAS as apostas pela mesma ordem.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 6000, tools: [{ type:'web_search_20250305', name:'web_search', max_uses: 10 }], messages: [{ role:'user', content: prompt }] })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Erro Anthropic ${res.status}`);
  const txt = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
  const parsed = extractJSON(txt);
  if (!parsed) throw new Error('JSON não encontrado na validação de apostas');
  return parsed.resultados || [];
}

// Valida todas as apostas pendentes de um uid. Atualiza status no Firestore.
async function validateUserBets(uid) {
  const all = await listBets(uid);
  const pending = all.filter(b => b.status === 'pending');
  if (!pending.length) return { ok: true, validated: 0, reason: 'Sem apostas pendentes' };

  const resultados = await askResults(pending);
  const byId = {}; resultados.forEach(r => { byId[r.id] = r; });

  let updated = 0; const changes = [];
  for (const bet of pending) {
    const r = byId[bet.id];
    if (!r || !r.status || r.status === 'pending') continue; // ainda sem resultado
    const status = ['won','lost','void'].includes(r.status) ? r.status : 'pending';
    if (status === 'pending') continue;
    await updateBetStatus(uid, bet.id, status);
    updated++;
    changes.push({ id: bet.id, match: bet.match, market: bet.market, status, resultado_real: r.resultado_real || '' });
  }
  return { ok: true, validated: updated, total: pending.length, changes };
}

module.exports = { validateUserBets };
