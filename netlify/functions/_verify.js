const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL || 'koresma@gmail.com';
let certsCache = { keys: null, exp: 0 };
async function getGoogleCerts() {
  const now = Date.now();
  if (certsCache.keys && now < certsCache.exp) return certsCache.keys;
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  const data = await res.json();
  const cc = res.headers.get('cache-control') || '';
  const maxAge = (cc.match(/max-age=(\d+)/) || [])[1];
  certsCache = { keys: data, exp: now + (maxAge ? parseInt(maxAge, 10) * 1000 : 3600 * 1000) };
  return data;
}
function b64urlToBuf(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function pemToPublicKey(pem) { const { createPublicKey, X509Certificate } = require('crypto'); try { return new X509Certificate(pem).publicKey; } catch { return createPublicKey(pem); } }
async function verifyFirebaseToken(idToken) {
  if (!idToken) throw new Error('No token');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID not set');
  const [h, p, s] = idToken.split('.');
  if (!h || !p || !s) throw new Error('Malformed token');
  const header = JSON.parse(b64urlToBuf(h).toString('utf8'));
  const payload = JSON.parse(b64urlToBuf(p).toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('Bad audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Bad issuer');
  if (payload.exp < now) throw new Error('Token expired');
  if (!payload.sub) throw new Error('No subject');
  if (payload.email !== ALLOWED_EMAIL) throw new Error('Email not allowed');
  if (payload.email_verified === false) throw new Error('Email not verified');
  const certs = await getGoogleCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error('Unknown key id');
  const { createVerify } = require('crypto');
  const v = createVerify('RSA-SHA256'); v.update(`${h}.${p}`); v.end();
  if (!v.verify(pemToPublicKey(pem), b64urlToBuf(s))) throw new Error('Invalid signature');
  return payload;
}
module.exports = { verifyFirebaseToken, ALLOWED_EMAIL };
