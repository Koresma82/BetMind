import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { getConfig, getAllBets, computeStats } from '../lib/db';
import { C, Card, Stat, Eyebrow, Loader, Empty } from '../components/ui';

const clr = n => n >= 0 ? C.acc : C.red;
const fmt = (n, u = '€') => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(2) + u;
const fmtPct = n => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(1) + '%';

export default function RelatorioPage() {
  const user = useAuth();
  const [bets, setBets] = useState([]);
  const [bms, setBms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => { (async () => { const [cfg, all] = await Promise.all([getConfig(user.uid), getAllBets(user.uid)]); setBms(cfg.bookmakers || []); setBets(all); setLoading(false); })(); }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const filtered = bets.filter(b => {
      if (period === 'all') return true;
      const ts = b.createdAt?.toDate?.() || new Date();
      const diff = now - ts;
      if (period === 'month') return diff < 30 * 864e5;
      if (period === '3m') return diff < 90 * 864e5;
      if (period === 'year') return diff < 365 * 864e5;
      return true;
    });
    return computeStats(filtered, bms);
  }, [bets, bms, period]);

  if (loading) return <Loader />;
  const maxAbs = Math.max(...(stats.byMonth.map(m => Math.abs(m.profit))), 1);

  return (
    <div className="stagger">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: -.7 }}>Relatório</h1>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-xs)', padding: '8px 12px', color: C.text, fontFamily: C.mono, fontSize: 11.5 }}>
          <option value="all">Tudo</option><option value="month">Último mês</option><option value="3m">3 meses</option><option value="year">Último ano</option>
        </select>
      </div>

      {stats.settled === 0 && <Empty icon="◧">Sem apostas resolvidas neste período.</Empty>}

      {stats.settled > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 11 }}>
            <Stat label="Lucro / Prejuízo" value={fmt(stats.profit)} color={clr(stats.profit)} accent={clr(stats.profit)} big />
            <Stat label="ROI" value={fmtPct(stats.roi)} color={clr(stats.roi)} accent={clr(stats.roi)} big />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 11, marginBottom: 11 }}>
            <Stat label="Acerto" value={stats.winRate.toFixed(0) + '%'} sub={`${stats.won}V ${stats.lost}D`} />
            <Stat label="Apostado" value={stats.totalInvested.toFixed(0) + '€'} sub={`${stats.settled} fechadas`} />
            <Stat label="Retornado" value={stats.totalReturned.toFixed(0) + '€'} color={C.blue} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 9, marginBottom: 22 }}>
            <Stat label="Série V" value={stats.maxWinStreak} color={C.acc} />
            <Stat label="Série D" value={stats.maxLossStreak} color={C.red} />
            <Stat label="Odd méd V" value={stats.avgOddWon.toFixed(2)} />
            <Stat label="Odd méd D" value={stats.avgOddLost.toFixed(2)} />
          </div>

          {(stats.bestBet || stats.worstBet) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 22 }}>
              {stats.bestBet && <Card accent={C.acc} pad={15}><Eyebrow color={C.acc} style={{ marginBottom: 8 }}>Melhor</Eyebrow><div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{stats.bestBet.match}</div><div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: C.acc }}>+{(stats.bestBet.amount * (stats.bestBet.odd - 1)).toFixed(2)}€ @{stats.bestBet.odd}</div></Card>}
              {stats.worstBet && <Card accent={C.red} pad={15}><Eyebrow color={C.red} style={{ marginBottom: 8 }}>Pior</Eyebrow><div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{stats.worstBet.match}</div><div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: C.red }}>-{stats.worstBet.amount.toFixed(2)}€ @{stats.worstBet.odd}</div></Card>}
            </div>
          )}

          {stats.byMarket.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <Eyebrow style={{ marginBottom: 12 }}>Por mercado</Eyebrow>
              {stats.byMarket.slice(0, 8).map(m => (
                <div key={m.market} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><div style={{ fontSize: 13, color: C.text }}>{m.market}</div><div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.text3, marginTop: 1 }}>{m.count} ap. · {m.winRate.toFixed(0)}%</div></div>
                  <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: clr(m.profit) }}>{fmt(m.profit)}</div>
                </div>
              ))}
            </Card>
          )}

          {stats.byMonth.length > 0 && (
            <Card>
              <Eyebrow style={{ marginBottom: 14 }}>Por mês</Eyebrow>
              {[...stats.byMonth].reverse().map(m => (
                <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3, minWidth: 58 }}>{m.month}</div>
                  <div style={{ flex: 1, height: 20, background: 'var(--surface)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${Math.abs(m.profit) / maxAbs * 100}%`, background: m.profit >= 0 ? 'rgba(0,229,138,0.25)' : 'rgba(255,77,109,0.25)', borderRadius: 5 }} />
                    <div style={{ position: 'absolute', left: 9, top: 0, height: '100%', display: 'flex', alignItems: 'center', fontFamily: C.mono, fontSize: 10.5, color: C.text }}>{fmt(m.profit)} ({m.count})</div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {stats.bySport && stats.bySport.length > 0 && (
            <Card style={{ marginTop: 16 }}>
              <Eyebrow style={{ marginBottom: 12 }}>Por modalidade</Eyebrow>
              {stats.bySport.map(s => (
                <div key={s.sport} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><div style={{ fontSize: 13, color: C.text }}>{s.sport}</div><div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.text3, marginTop: 1 }}>{s.count} ap. · {s.winRate.toFixed(0)}%</div></div>
                  <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: clr(s.profit) }}>{fmt(s.profit)}</div>
                </div>
              ))}
            </Card>
          )}

          {stats.aiStats && stats.aiStats.count > 0 && (
            <Card style={{ marginTop: 16 }} accent={C.violet}>
              <Eyebrow style={{ marginBottom: 12 }}>Desempenho das sugestões IA</Eyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <Stat label="Apostas IA" value={stats.aiStats.count} />
                <Stat label="Acerto" value={stats.aiStats.winRate.toFixed(0) + '%'} color={stats.aiStats.winRate >= 50 ? C.acc : C.orange} />
                <Stat label="Lucro IA" value={fmt(stats.aiStats.profit)} color={clr(stats.aiStats.profit)} />
              </div>
              {stats.byConfidence && stats.byConfidence.some(b => b.total > 0) && (
                <>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.text3, letterSpacing: 1.5, margin: '4px 0 8px' }}>ACERTO POR CONFIANÇA DA SUGESTÃO</div>
                  {stats.byConfidence.map(b => b.total > 0 && (
                    <div key={b.band} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                      <span style={{ fontFamily: C.mono, fontSize: 12, color: C.text2 }}>{b.band === '70+' ? '≥70%' : b.band === '55-69' ? '55–69%' : '<55%'}</span>
                      <span style={{ fontFamily: C.mono, fontSize: 12, color: b.winRate >= 50 ? C.acc : C.orange }}>{b.winRate.toFixed(0)}% ({b.won}/{b.total})</span>
                    </div>
                  ))}
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
