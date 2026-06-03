function extractJSON(txt) {
  if (!txt) return null;
  let m = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch {} }
  const start = txt.indexOf('{'); if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < txt.length; i++) {
    const c = txt[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(txt.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

async function callAnthropic(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }], messages: [{ role: 'user', content: prompt }] })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Erro Anthropic ${res.status}`);
  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const parsed = extractJSON(txt);
  if (!parsed) throw new Error('JSON não encontrado na validação');
  return parsed;
}

function buildPrompt(dateISO, prediction) {
  const jogos = (prediction.jogos || []).map(j => ({ id: j.id, modalidade: j.modalidade, jogo: `${j.casa} vs ${j.fora}`, competicao: j.competicao, confianca: j.confianca_maxima, mercados: (j.mercados || []).map(mk => ({ mercado: mk.mercado, confianca: mk.confianca, odd: mk.odd })) }));
  return `Estás a VALIDAR previsões desportivas do dia ${dateISO}. Pesquisa os RESULTADOS REAIS (já terminaram). Para cada mercado: "green" se ganhou, "red" se perdeu, "void" se anulado/sem resultado.
Previsões (JSON):
${JSON.stringify(jogos)}
Responde APENAS com JSON válido, sem markdown:
{"data":"${dateISO}","jogos_validados":[{"id":"jogo1","jogo":"A vs B","modalidade":"Futebol","resultado_real":"2-1","mercados":[{"mercado":"Mais de 2.5 Golos","odd":"1.85","confianca":78,"resultado":"green"}]}]}
Inclui TODOS os jogos.`;
}

function computeDailyStats(validated) {
  let green = 0, red = 0, voidc = 0, total = 0, stakeUnits = 0, returnUnits = 0;
  const bySport = {}; const byConfidenceBand = { '70+': { g: 0, t: 0 }, '55-69': { g: 0, t: 0 }, '<55': { g: 0, t: 0 } };
  (validated.jogos_validados || []).forEach(j => {
    const sport = j.modalidade || 'Outro';
    bySport[sport] = bySport[sport] || { green: 0, red: 0, void: 0, total: 0 };
    (j.mercados || []).forEach(mk => {
      total++; bySport[sport].total++;
      const conf = mk.confianca || 0; const band = conf >= 70 ? '70+' : conf >= 55 ? '55-69' : '<55';
      if (mk.resultado === 'green') { green++; bySport[sport].green++; stakeUnits++; returnUnits += parseFloat(mk.odd) || 1; byConfidenceBand[band].g++; byConfidenceBand[band].t++; }
      else if (mk.resultado === 'red') { red++; bySport[sport].red++; stakeUnits++; byConfidenceBand[band].t++; }
      else { voidc++; bySport[sport].void++; }
    });
  });
  const decided = green + red;
  return { total, green, red, void: voidc, decided, hitRate: decided > 0 ? Math.round((green / decided) * 1000) / 10 : 0, profitUnits: Math.round((returnUnits - stakeUnits) * 100) / 100, roiUnits: stakeUnits > 0 ? Math.round(((returnUnits - stakeUnits) / stakeUnits) * 1000) / 10 : 0, bySport, byConfidenceBand };
}

async function validateForDate(uid, dateISO, fs) {
  const prediction = await fs.getDoc(`users/${uid}/predictions/${dateISO}`);
  if (!prediction || !(prediction.jogos && prediction.jogos.length)) return { skipped: true, reason: 'Sem previsões para ' + dateISO };
  const validated = await callAnthropic(buildPrompt(dateISO, prediction));
  const stats = computeDailyStats(validated);
  await fs.setDoc(`users/${uid}/predictionResults/${dateISO}`, { data: dateISO, validatedAt: new Date().toISOString(), stats, jogos_validados: validated.jogos_validados || [] });
  return { ok: true, date: dateISO, stats };
}

module.exports = { callAnthropic, buildPrompt, computeDailyStats, validateForDate, extractJSON };
