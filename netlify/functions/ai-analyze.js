// Análise RÁPIDA — desenhada para caber no limite de ~10s das functions normais.
// Poucas pesquisas web, resposta enxuta (top picks). Funciona em netlify dev e produção.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const cors = () => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin'
});
const json = (status, obj) => ({ statusCode: status, headers: { ...cors(), 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method Not Allowed' };
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: 'Servidor sem ANTHROPIC_API_KEY. Preenche o .env (ver README).' });

  try {
    const {
      prompt, system,
      useWebSearch = true,
      maxTokens = 3000,     // enxuto para ser rápido
      maxSearches = 3       // poucas pesquisas → cabe nos 10s
    } = JSON.parse(event.body || '{}');
    if (!prompt) return json(400, { error: 'prompt em falta' });

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: Math.min(maxTokens, 5000),
      messages: [{ role: 'user', content: prompt }]
    };
    if (system) body.system = system;
    if (useWebSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: Math.min(maxSearches, 4) }];

    // Aborta antes do limite da Netlify para devolvermos um erro limpo (não "TimeoutErr")
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 24000);

    let res, data;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      data = await res.json();
    } catch (e) {
      if (e.name === 'AbortError') return json(504, { error: 'A análise rápida demorou demasiado. Usa a Análise Profunda para resultados completos.' });
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return json(res.status, { error: data?.error?.message || `Erro da API Anthropic (${res.status})`, detail: data });
    return json(200, data);
  } catch (e) {
    return json(500, { error: e.message });
  }
};
