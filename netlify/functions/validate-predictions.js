const fs = require('./_firestore');
const { validateForDate } = require('./_validation');
const ALLOWED_UID = process.env.ALLOWED_UID;
function targetDateISO() {
  const now = new Date();
  const lisbon = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
  lisbon.setDate(lisbon.getDate() - 1);
  return lisbon.toISOString().split('T')[0];
}
exports.handler = async (event) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY em falta');
    if (!ALLOWED_UID) throw new Error('ALLOWED_UID em falta');
    const dateISO = event?.queryStringParameters?.date || targetDateISO();
    const result = await validateForDate(ALLOWED_UID, dateISO, fs);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
