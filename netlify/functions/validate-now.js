const { verifyFirebaseToken } = require('./_verify');
const fs = require('./_firestore');
const { validateForDate } = require('./_validation');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const cors = () => ({ 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' });
const json = (s, o) => ({ statusCode: s, headers: { ...cors(), 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method Not Allowed' };
  if (!process.env.FIREBASE_PROJECT_ID) return json(500, { error: 'Servidor sem FIREBASE_PROJECT_ID (ver README).' });
  let payload;
  try { const a = event.headers.authorization || event.headers.Authorization || ''; payload = await verifyFirebaseToken(a.replace(/^Bearer\s+/i, '')); }
  catch (e) { return json(401, { error: 'Não autorizado: ' + e.message }); }
  try {
    const { date } = JSON.parse(event.body || '{}');
    if (!date) return json(400, { error: 'date obrigatório' });
    const result = await validateForDate(payload.sub, date, fs);
    if (result.skipped) return json(404, { error: result.reason });
    return json(200, result);
  } catch (e) { return json(500, { error: e.message }); }
};
