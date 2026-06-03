const { validateUserBets } = require('./_betvalidation');
const ALLOWED_UID = process.env.ALLOWED_UID;
exports.handler = async () => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY em falta');
    if (!ALLOWED_UID) throw new Error('ALLOWED_UID em falta');
    const r = await validateUserBets(ALLOWED_UID);
    console.log('Validação de apostas:', JSON.stringify(r));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) { console.error('validate-bets-scheduled:', e.message); return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
