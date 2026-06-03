import { db } from './firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, setDoc, getDoc, writeBatch, Timestamp
} from 'firebase/firestore';

const betsCol = (uid) => collection(db, 'users', uid, 'bets');
const cfgDoc  = (uid) => doc(db, 'users', uid, 'config', 'main');

// ── Config / Bookmakers ──────────────────────────
export async function getConfig(uid) {
  const snap = await getDoc(cfgDoc(uid));
  return snap.exists() ? snap.data() : { bookmakers: [] };
}
export async function saveConfig(uid, config) {
  await setDoc(cfgDoc(uid), config, { merge: true });
}

// ── Bets ─────────────────────────────────────────
export async function addBet(uid, bet) {
  return await addDoc(betsCol(uid), {
    ...bet,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
}
export async function updateBet(uid, betId, updates) {
  await updateDoc(doc(betsCol(uid), betId), { ...updates, updatedAt: Timestamp.now() });
}
export async function deleteBet(uid, betId) {
  await deleteDoc(doc(betsCol(uid), betId));
}
export async function getAllBets(uid) {
  const q = query(betsCol(uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function deleteAllBets(uid) {
  const snap = await getDocs(betsCol(uid));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ── Stats ────────────────────────────────────────
export function computeStats(bets, bookmakers = []) {
  const settled = bets.filter(b => b.status === 'won' || b.status === 'lost');
  const won     = settled.filter(b => b.status === 'won');
  const lost    = settled.filter(b => b.status === 'lost');
  const pending = bets.filter(b => b.status === 'pending');

  const totalInvested  = settled.reduce((s, b) => s + (b.amount || 0), 0);
  const totalReturned  = won.reduce((s, b) => s + (b.amount || 0) * (b.odd || 1), 0);
  const profit         = totalReturned - totalInvested;
  const roi            = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
  const winRate        = settled.length > 0 ? (won.length / settled.length) * 100 : 0;
  const avgOddWon      = won.length  > 0 ? won.reduce((s,b)=>s+b.odd,0)  / won.length  : 0;
  const avgOddLost     = lost.length > 0 ? lost.reduce((s,b)=>s+b.odd,0) / lost.length : 0;

  const pendingAmount  = pending.reduce((s, b) => s + (b.amount || 0), 0);

  // Best & worst
  const betProfit = b => b.status === 'won' ? b.amount * (b.odd - 1) : -b.amount;
  const sortedP   = [...settled].sort((a,b) => betProfit(b) - betProfit(a));
  const bestBet   = sortedP[0] || null;
  const worstBet  = sortedP[sortedP.length - 1] || null;

  // Streak
  const ordered = [...settled].sort((a,b) => a.createdAt?.toMillis?.() - b.createdAt?.toMillis?.() || 0);
  let maxWin=0,maxLoss=0,curW=0,curL=0;
  ordered.forEach(b => {
    if (b.status==='won') { curW++; curL=0; maxWin=Math.max(maxWin,curW); }
    else                  { curL++; curW=0; maxLoss=Math.max(maxLoss,curL); }
  });

  // By bookmaker — modelo: debita ao apostar (pendentes saem do saldo)
  const byBookmaker = bookmakers.map(bm => {
    const allBm     = bets.filter(b => b.bookmakerId === bm.id);
    const bmSettled = allBm.filter(b => b.status === 'won' || b.status === 'lost');
    const bmWon     = bmSettled.filter(b => b.status==='won');
    const bmLost    = bmSettled.filter(b => b.status==='lost');
    const bmPendingBets = allBm.filter(b => b.status==='pending');
    const bmInv     = bmSettled.reduce((s,b)=>s+(b.amount||0),0);
    const bmRet     = bmWon.reduce((s,b)=>s+(b.amount||0)*(b.odd||1),0);
    const bmProfit  = bmRet - bmInv;
    const bmPending = bmPendingBets.reduce((s,b)=>s+(b.amount||0),0);
    // Saldo: inicial menos o que está em risco (pendentes), menos apostado resolvido, mais retorno das ganhas.
    const bmBalance = (bm.initialBudget||0) - bmInv - bmPending + bmRet;
    const bmStake   = bmInv + bmPending;
    const bmRoi     = bmInv > 0 ? (bmProfit / bmInv) * 100 : 0;
    const bmAvgStake = allBm.length > 0 ? bmStake / allBm.length : 0;
    return {
      ...bm,
      betsCount: bmSettled.length,
      totalBets: allBm.length,
      wonCount:  bmWon.length,
      lostCount: bmLost.length,
      pendingCount: bmPendingBets.length,
      invested:  bmInv,
      returned:  bmRet,
      profit:    bmProfit,
      balance:   bmBalance,
      roi:       bmRoi,
      avgStake:  bmAvgStake,
      winRate:   bmSettled.length > 0 ? (bmWon.length/bmSettled.length)*100 : 0,
      pendingAmount: bmPending,
      // % de variação face ao saldo inicial
      growth: (bm.initialBudget||0) > 0 ? ((bmBalance - bm.initialBudget) / bm.initialBudget) * 100 : 0
    };
  });

  // By market
  const marketMap = {};
  settled.forEach(b => {
    const mk = b.market || 'Outro';
    if (!marketMap[mk]) marketMap[mk] = { market: mk, count:0, won:0, invested:0, returned:0 };
    marketMap[mk].count++;
    marketMap[mk].invested += b.amount||0;
    if (b.status==='won') { marketMap[mk].won++; marketMap[mk].returned += (b.amount||0)*(b.odd||1); }
  });
  const byMarket = Object.values(marketMap)
    .map(m => ({ ...m, winRate: m.count>0?(m.won/m.count)*100:0, profit: m.returned-m.invested }))
    .sort((a,b) => b.profit - a.profit);

  // By sport (modalidade)
  const sportMap = {};
  settled.forEach(b => {
    const sp = b.sport || 'Outro';
    if (!sportMap[sp]) sportMap[sp] = { sport: sp, count:0, won:0, invested:0, returned:0 };
    sportMap[sp].count++; sportMap[sp].invested += b.amount||0;
    if (b.status==='won') { sportMap[sp].won++; sportMap[sp].returned += (b.amount||0)*(b.odd||1); }
  });
  const bySport = Object.values(sportMap)
    .map(s => ({ ...s, winRate: s.count>0?(s.won/s.count)*100:0, profit: s.returned-s.invested }))
    .sort((a,b) => b.profit - a.profit);

  // Apostas vindas de sugestões da IA vs manuais
  const fromAI = settled.filter(b => b.source === 'ai');
  const aiWon  = fromAI.filter(b => b.status==='won');
  const aiInv  = fromAI.reduce((s,b)=>s+(b.amount||0),0);
  const aiRet  = aiWon.reduce((s,b)=>s+(b.amount||0)*(b.odd||1),0);
  const aiStats = {
    count: fromAI.length, won: aiWon.length,
    winRate: fromAI.length>0 ? (aiWon.length/fromAI.length)*100 : 0,
    profit: aiRet - aiInv,
    roi: aiInv>0 ? ((aiRet-aiInv)/aiInv)*100 : 0
  };

  // Acerto por banda de confiança da sugestão IA
  const bandsDef = { '70+':[70,101], '55-69':[55,70], '<55':[0,55] };
  const byConfidence = Object.entries(bandsDef).map(([label,[lo,hi]]) => {
    const inBand = fromAI.filter(b => (b.aiConfidence||0)>=lo && (b.aiConfidence||0)<hi && (b.status==='won'||b.status==='lost'));
    const w = inBand.filter(b=>b.status==='won').length;
    return { band: label, total: inBand.length, won: w, winRate: inBand.length>0?(w/inBand.length)*100:0 };
  });

  const totalBankInitial = bookmakers.reduce((s,bm)=>s+(bm.initialBudget||0),0);
  const totalBalance = byBookmaker.reduce((s,bm)=>s+bm.balance,0);
  const bestBookmaker  = [...byBookmaker].sort((a,b)=>b.profit-a.profit)[0] || null;
  const worstBookmaker = [...byBookmaker].sort((a,b)=>a.profit-b.profit)[0] || null;
  const avgStakeAll = settled.length>0 ? totalInvested/settled.length : 0;

  // By month
  const monthMap = {};
  settled.forEach(b => {
    const ts = b.createdAt?.toDate?.() || new Date(b.createdAt || Date.now());
    const key = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}`;
    if (!monthMap[key]) monthMap[key] = { month: key, invested:0, returned:0, count:0, won:0 };
    monthMap[key].count++;
    monthMap[key].invested += b.amount||0;
    if (b.status==='won') { monthMap[key].won++; monthMap[key].returned += (b.amount||0)*(b.odd||1); }
  });
  const byMonth = Object.values(monthMap)
    .sort((a,b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, profit: m.returned - m.invested }));

  return {
    total: bets.length, settled: settled.length, won: won.length,
    lost: lost.length, pending: pending.length,
    totalInvested, totalReturned, profit, roi, winRate,
    avgOddWon, avgOddLost, pendingAmount, avgStakeAll,
    bestBet, worstBet, maxWinStreak: maxWin, maxLossStreak: maxLoss,
    byBookmaker, byMarket, byMonth, bySport,
    aiStats, byConfidence,
    totalBankInitial, totalBalance, bestBookmaker, worstBookmaker
  };
}

// ── Análise profunda (escrita pela background function) ──────────
export async function getDeepAnalysis(uid, date) {
  const snap = await getDoc(doc(db, 'users', uid, 'deepAnalysis', date));
  return snap.exists() ? snap.data() : null;
}

// ── Resultados de validação IA (escritos pelo servidor) ──────────
export async function getPredictionResults(uid) {
  const q = query(collection(db, 'users', uid, 'predictionResults'), orderBy('data', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function computePredictionSummary(results) {
  let green = 0, red = 0, voidc = 0, days = 0, profitUnits = 0;
  const band = { '70+': { g: 0, t: 0 }, '55-69': { g: 0, t: 0 }, '<55': { g: 0, t: 0 } };
  const sportAgg = {};
  results.forEach(r => {
    const s = r.stats; if (!s) return;
    days++; green += s.green || 0; red += s.red || 0; voidc += s.void || 0; profitUnits += s.profitUnits || 0;
    if (s.byConfidenceBand) Object.keys(band).forEach(k => {
      band[k].g += s.byConfidenceBand[k]?.g || 0;
      band[k].t += s.byConfidenceBand[k]?.t || 0;
    });
    if (s.bySport) Object.entries(s.bySport).forEach(([sp, v]) => {
      sportAgg[sp] = sportAgg[sp] || { green: 0, red: 0, void: 0, total: 0 };
      sportAgg[sp].green += v.green || 0; sportAgg[sp].red += v.red || 0;
      sportAgg[sp].void += v.void || 0; sportAgg[sp].total += v.total || 0;
    });
  });
  const decided = green + red;
  return {
    days, green, red, void: voidc, decided,
    hitRate: decided > 0 ? Math.round((green / decided) * 1000) / 10 : 0,
    profitUnits: Math.round(profitUnits * 100) / 100,
    byConfidenceBand: band,
    bySport: Object.entries(sportAgg).map(([sport, v]) => ({
      sport, ...v,
      hitRate: (v.green + v.red) > 0 ? Math.round((v.green / (v.green + v.red)) * 1000) / 10 : 0
    })).sort((a, b) => b.total - a.total)
  };
}

// ── Última análise (rápida/liga) — persiste entre mudanças de tab ──
// Guardada por tipo: 'dia' ou 'liga'. Sobrevive a navegação e refrescos.
export async function saveLastAnalysis(uid, kind, data) {
  await setDoc(doc(db, 'users', uid, 'lastAnalysis', kind), {
    kind, savedAt: new Date().toISOString(), data
  });
}
export async function getLastAnalysis(uid, kind) {
  const snap = await getDoc(doc(db, 'users', uid, 'lastAnalysis', kind));
  return snap.exists() ? snap.data() : null;
}

// ── Apostas a partir de sugestões da IA ──────────────────────────
// Grava uma aposta com metadados da sugestão (origem, confiança, modalidade).
export async function placeBet(uid, bet) {
  return await addDoc(betsCol(uid), {
    match: bet.match || '',
    competition: bet.competition || '',
    sport: bet.sport || 'Outro',
    market: bet.market || '',
    odd: parseFloat(bet.odd) || 1,
    amount: parseFloat(bet.amount) || 0,
    bookmakerId: bet.bookmakerId || '',
    source: bet.source || 'manual',          // 'ai' | 'manual'
    aiConfidence: bet.aiConfidence ?? null,   // 0-100 se veio da IA
    eventDate: bet.eventDate || new Date().toISOString().split('T')[0],
    notes: bet.notes || '',
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
}

// Conta apostas pendentes (para a validação automática saber se há trabalho)
export async function getPendingBets(uid) {
  const snap = await getDocs(betsCol(uid));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.status === 'pending');
}
