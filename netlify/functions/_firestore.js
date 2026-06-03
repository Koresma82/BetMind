const { createSign } = require('crypto');
let tokenCache = { token: null, exp: 0 };
function getServiceAccount() { const raw = process.env.FIREBASE_SERVICE_ACCOUNT; if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada'); return JSON.parse(raw); }
function b64url(input) { return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && now < tokenCache.exp - 60) return tokenCache.token;
  const sa = getServiceAccount();
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = createSign('RSA-SHA256'); signer.update(signingInput); signer.end();
  const signature = signer.sign(sa.private_key).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${signingInput}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  const data = await res.json();
  if (!data.access_token) throw new Error('Falha access token: ' + JSON.stringify(data));
  tokenCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}
function projectId() { return process.env.FIREBASE_PROJECT_ID || getServiceAccount().project_id; }
const BASE = () => `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') { const fields = {}; for (const k of Object.keys(v)) fields[k] = toFirestoreValue(v[k]); return { mapValue: { fields } }; }
  return { stringValue: String(v) };
}
function fromFirestoreValue(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) { const out = {}; const f = val.mapValue.fields || {}; for (const k of Object.keys(f)) out[k] = fromFirestoreValue(f[k]); return out; }
  return null;
}
function docToObject(doc) { const out = {}; const f = doc.fields || {}; for (const k of Object.keys(f)) out[k] = fromFirestoreValue(f[k]); return out; }
async function getDoc(path) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE()}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('getDoc: ' + (await res.text()));
  return docToObject(await res.json());
}
async function setDoc(path, obj) {
  const token = await getAccessToken();
  const fields = {}; for (const k of Object.keys(obj)) fields[k] = toFirestoreValue(obj[k]);
  const res = await fetch(`${BASE()}/${path}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error('setDoc: ' + (await res.text()));
  return await res.json();
}
module.exports = { getDoc, setDoc, getAccessToken, projectId, toFirestoreValue, fromFirestoreValue };
