// Helper: lista apostas de um utilizador via REST (a coleção users/{uid}/bets)
const { getAccessToken, projectId } = require('./_firestore');

function fromVal(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromVal);
  if ('mapValue' in val) { const o={}; const f=val.mapValue.fields||{}; for (const k of Object.keys(f)) o[k]=fromVal(f[k]); return o; }
  return null;
}

async function listBets(uid) {
  const token = await getAccessToken();
  const base = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
  const out = []; let pageToken = '';
  do {
    const url = `${base}/users/${uid}/bets?pageSize=300${pageToken?`&pageToken=${pageToken}`:''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) break;
    if (!res.ok) throw new Error('listBets: ' + (await res.text()));
    const data = await res.json();
    (data.documents || []).forEach(d => {
      const id = d.name.split('/').pop();
      const obj = {}; const f = d.fields || {};
      for (const k of Object.keys(f)) obj[k] = fromVal(f[k]);
      out.push({ id, ...obj });
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function updateBetStatus(uid, betId, status) {
  const token = await getAccessToken();
  const base = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
  // updateMask para só mexer em status e updatedAt
  const url = `${base}/users/${uid}/bets/${betId}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: status }, updatedAt: { timestampValue: new Date().toISOString() } } })
  });
  if (!res.ok) throw new Error('updateBetStatus: ' + (await res.text()));
  return await res.json();
}

module.exports = { listBets, updateBetStatus };
