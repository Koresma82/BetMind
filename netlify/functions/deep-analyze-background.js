// Análise PROFUNDA — background function (até 15 min na Netlify).
// NÃO corre em "netlify dev"; só funciona publicada no Netlify.
// Faz pesquisa exaustiva e grava o resultado em users/{uid}/deepAnalysis/{date}.
const { verifyFirebaseToken } = require('./_verify');
const { setDoc } = require('./_firestore');

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callDeep(prompt, system, attempt = 1) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  // Rate limit (429): espera e tenta de novo (é background, há tempo). Até 3 tentativas.
  if (res.status === 429 && attempt <= 3) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    const waitMs = (retryAfter > 0 ? retryAfter : 60) * 1000;
    console.log(`Rate limit. A esperar ${waitMs/1000}s antes da tentativa ${attempt+1}...`);
    await sleep(waitMs);
    return callDeep(prompt, system, attempt + 1);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Erro Anthropic ${res.status}`);
  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return { parsed: extractJSON(txt), txt, stop: data.stop_reason };
}

exports.handler = async (event) => {
  // Background functions devolvem 202 imediatamente; o corpo corre depois.
  let uid, date, prompt, system;
  try {
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const payload = await verifyFirebaseToken(auth.replace(/^Bearer\s+/i, ''));
    uid = payload.sub;
    ({ date, prompt, system } = JSON.parse(event.body || '{}'));
  } catch (e) {
    // Não há como devolver erro ao cliente (é background); grava nada e sai.
    console.error('Auth/parse falhou:', e.message);
    return { statusCode: 401 };
  }

  const docPath = `users/${uid}/deepAnalysis/${date}`;
  try {
    await setDoc(docPath, { status: 'running', startedAt: new Date().toISOString(), data: date });
    let { parsed, txt, stop } = await callDeep(prompt, system);
    if (!parsed) {
      const reforco = `${prompt}\n\nResponde APENAS com o objeto JSON, a começar por "{" e a terminar por "}". Sem texto à volta.`;
      ({ parsed, txt, stop } = await callDeep(reforco, system));
    }
    if (!parsed) {
      await setDoc(docPath, { status: 'error', finishedAt: new Date().toISOString(), data: date, error: 'Não foi possível extrair JSON', preview: (txt || '').slice(0, 300) });
      return { statusCode: 200 };
    }
    if (parsed.jogos) parsed.jogos.sort((a, b) => (b.confianca_maxima || 0) - (a.confianca_maxima || 0));
    await setDoc(docPath, { status: 'done', finishedAt: new Date().toISOString(), data: date, result: parsed });
    return { statusCode: 200 };
  } catch (e) {
    try { await setDoc(docPath, { status: 'error', finishedAt: new Date().toISOString(), data: date, error: e.message }); } catch {}
    return { statusCode: 200 };
  }
};
