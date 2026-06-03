import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getConfig, getAllBets, updateBet, computeStats } from '../lib/db';
import { C, Card, Stat, Eyebrow, Tag, Bar, PageHeader, Loader, Empty } from '../components/ui';

const fmt = (n, dec = 2) => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(dec) + '€';
const fmtPct = n => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(1) + '%';
const clr = n => n >= 0 ? C.acc : C.red;
const STATUS = { pending: ['Pendente', C.gold], won: ['Ganhou', C.acc], lost: ['Perdeu', C.red], void: ['Nulo', C.text3] };

export default function DashboardPage() {
  const user = useAuth();
  const nav = useNavigate();
  const [bets, setBets] = useState([]);
  const [bms, setBms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [cfg, allBets] = await Promise.all([getConfig(user.uid), getAllBets(user.uid)]);
    setBms(cfg.bookmakers || []); setBets(allBets); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => (bets.length || bms.length) ? computeStats(bets, bms) : null, [bets, bms]);
  const markBet = async (id, status) => { await updateBet(user.uid, id, { status }); load(); };

  if (loading) return <Loader />;
  const today = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="stagger">
      <PageHeader eyebrow={today} title="Painel" />

      {bms.length === 0 && (
        <Card accent={C.gold} hover onClick={() => nav('/config')} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ color: C.gold, fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Configura as casas de apostas</div>
              <div style={{ fontFamily: C.mono, fontSize: 11.5, color: C.text3 }}>Toca para ir às definições →</div>
            </div>
          </div>
        </Card>
      )}

      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 11 }}>
            <Stat label="Lucro total" value={fmt(stats.profit)} color={clr(stats.profit)} accent={clr(stats.profit)} big />
            <Stat label="ROI" value={fmtPct(stats.roi)} color={clr(stats.roi)} accent={clr(stats.roi)} big />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 11, marginBottom: 24 }}>
            <Stat label="Taxa acerto" value={stats.winRate.toFixed(0) + '%'} sub={`${stats.won}V · ${stats.lost}D`} />
            <Stat label="Apostado" value={stats.totalInvested.toFixed(0) + '€'} sub={`${stats.settled} fechadas`} />
            <Stat label="Pendentes" value={stats.pending} sub={`${stats.pendingAmount.toFixed(0)}€ risco`} color={C.gold} />
          </div>

          {stats.byBookmaker.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Eyebrow style={{ marginBottom: 12 }}>Casas de apostas</Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {stats.byBookmaker.map(bm => {
                  const pct = bm.initialBudget > 0 ? (bm.balance / bm.initialBudget) * 100 : 100;
                  return (
                    <Card key={bm.id} pad={15} accent={bm.color || C.acc} hover>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 11 }}>
                        <div>
                          <div style={{ fontSize: 15, color: C.text, fontWeight: 600, letterSpacing: -.2 }}>{bm.name}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3, marginTop: 2 }}>{bm.betsCount} apostas · {bm.winRate.toFixed(0)}% acerto</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: C.mono, fontSize: 17, fontWeight: 700, color: clr(bm.profit) }}>{fmt(bm.profit)}</div>
                          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3, marginTop: 1 }}>saldo {bm.balance.toFixed(0)}€</div>
                        </div>
                      </div>
                      <Bar pct={Math.min(pct, 100)} color={bm.profit >= 0 ? (bm.color || C.acc) : C.red} />
                      {bm.pendingAmount > 0 && <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.gold, marginTop: 8 }}>▸ {bm.pendingAmount.toFixed(0)}€ pendentes</div>}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {bets.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Eyebrow>Apostas recentes</Eyebrow>
                <button onClick={() => nav('/historico')} style={{ background: 'none', border: 'none', color: C.acc, fontFamily: C.mono, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>ver tudo →</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {bets.slice(0, 5).map(b => <BetRow key={b.id} bet={b} bms={bms} onMark={markBet} />)}
              </div>
            </div>
          )}

          {bets.length === 0 && bms.length > 0 && (
            <Empty icon="○">Sem apostas ainda.<br /><span style={{ color: C.acc, cursor: 'pointer' }} onClick={() => nav('/historico')}>Regista a primeira →</span></Empty>
          )}
        </>
      )}
    </div>
  );
}

function BetRow({ bet, bms, onMark }) {
  const bm = bms.find(b => b.id === bet.bookmakerId);
  const ts = bet.createdAt?.toDate?.() || new Date(bet.createdAt || Date.now());
  const pot = ((bet.amount || 0) * (bet.odd || 1)).toFixed(2);
  const [lbl, col] = STATUS[bet.status] || STATUS.pending;
  return (
    <Card pad={14} hover>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9 }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 3, letterSpacing: -.2 }}>{bet.match}</div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3 }}>{bet.market} · @{bet.odd} · {bm?.name || '?'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 600, color: C.text }}>{(bet.amount || 0).toFixed(0)}€</div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3, marginTop: 1 }}>→ {pot}€</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: C.mono, fontSize: 10, color: C.text4 }}>{ts.toLocaleDateString('pt-PT')}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {bet.status === 'pending' ? (
            <>
              <MiniBtn c={C.acc} onClick={() => onMark(bet.id, 'won')}>✓</MiniBtn>
              <MiniBtn c={C.red} onClick={() => onMark(bet.id, 'lost')}>✗</MiniBtn>
              <MiniBtn c={C.text3} onClick={() => onMark(bet.id, 'void')}>○</MiniBtn>
            </>
          ) : <Tag label={lbl} color={col} />}
        </div>
      </div>
    </Card>
  );
}

function MiniBtn({ c, onClick, children }) {
  return <button onClick={onClick} style={{ background: `${c}18`, border: `1px solid ${c}3a`, borderRadius: 7, padding: '4px 10px', color: c, cursor: 'pointer', fontFamily: C.mono, fontSize: 12, fontWeight: 600, transition: 'all .14s' }}
    onMouseEnter={e => e.currentTarget.style.background = `${c}2e`} onMouseLeave={e => e.currentTarget.style.background = `${c}18`}>{children}</button>;
}
