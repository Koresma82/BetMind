import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { getPredictionResults, computePredictionSummary } from '../lib/db';
<<<<<<< HEAD
import { validateNow, validateBetsNow } from '../lib/api';
=======
import { validateNow } from '../lib/api';
>>>>>>> 991199c57d225aefc13d574a27e0c072a1efefdf
import { C, Card, Stat, Eyebrow, Bar, PageHeader, Loader, Empty, Button, Notice, Tag } from '../components/ui';

const RES_C = { green: C.acc, red: C.red, void: C.text3 };
const RES_LBL = { green: 'GREEN', red: 'RED', void: 'NULO' };
const ICON = { 'Futebol': '⚽', 'Ténis': '🎾', 'Basquetebol': '🏀', 'Andebol': '🤾', 'Hóquei em Gelo': '🏒', 'Rugby': '🏉', 'Voleibol': '🏐', 'Basebol': '⚾', 'MMA/Boxe': '🥊', 'Ciclismo': '🚴', 'Fórmula 1': '🏎️', 'Outro': '🎯' };
const todayISO = () => new Date().toISOString().split('T')[0];
const yesterdayISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };
const fmtDate = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return iso; } };

export default function PrevisoesPage() {
  const user = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [openDay, setOpenDay] = useState(null);

  const summary = useMemo(() => computePredictionSummary(results), [results]);

  const load = async () => {
    try { setResults(await getPredictionResults(user.uid)); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const run = async (date) => {
    setValidating(true); setErr(''); setMsg('');
    try { const r = await validateNow(date); setMsg(`${date} validado · ${r.stats.green}G/${r.stats.red}R · ${r.stats.hitRate}% acerto`); await load(); }
    catch (e) { setErr(e.message); }
    setValidating(false);
  };

<<<<<<< HEAD
  const runBets = async () => {
    setValidating(true); setErr(''); setMsg('');
    try {
      const r = await validateBetsNow();
      setMsg(r.validated ? `${r.validated} aposta(s) validada(s) de ${r.total} pendentes.` : (r.reason || 'Sem apostas pendentes.'));
    } catch (e) { setErr(e.message); }
    setValidating(false);
  };

=======
>>>>>>> 991199c57d225aefc13d574a27e0c072a1efefdf
  if (loading) return <Loader />;

  return (
    <div className="stagger">
      <PageHeader eyebrow="Validação automática à meia-noite" title="Previsões IA" />

<<<<<<< HEAD
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <Button variant="ghost" full size="sm" disabled={validating} onClick={() => run(yesterdayISO())}>{validating ? 'A validar…' : '⟳ Validar sugestões (ontem)'}</Button>
        <Button variant="ghost" full size="sm" disabled={validating} onClick={() => run(todayISO())}>{validating ? '…' : '⟳ Hoje'}</Button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Button variant="primary" full size="sm" disabled={validating} onClick={runBets}>{validating ? 'A validar apostas…' : '✓ Validar as MINHAS apostas pendentes'}</Button>
=======
      <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
        <Button variant="ghost" full size="sm" disabled={validating} onClick={() => run(yesterdayISO())}>{validating ? 'A validar…' : '⟳ Validar ontem'}</Button>
        <Button variant="ghost" full size="sm" disabled={validating} onClick={() => run(todayISO())}>{validating ? '…' : '⟳ Validar hoje'}</Button>
>>>>>>> 991199c57d225aefc13d574a27e0c072a1efefdf
      </div>

      {msg && <div style={{ marginBottom: 12 }}><Notice kind="success">{msg}</Notice></div>}
      {err && <div style={{ marginBottom: 12 }}><Notice kind="error">{err}</Notice></div>}

      {summary.decided > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 11 }}>
            <Stat label="Acerto global" value={summary.hitRate + '%'} sub={`${summary.green}G · ${summary.red}R`} color={summary.hitRate >= 50 ? C.acc : C.orange} accent={summary.hitRate >= 50 ? C.acc : C.orange} big />
            <Stat label="Lucro (unidades)" value={(summary.profitUnits >= 0 ? '+' : '') + summary.profitUnits + 'u'} sub={`${summary.days} dias`} color={summary.profitUnits >= 0 ? C.acc : C.red} accent={summary.profitUnits >= 0 ? C.acc : C.red} big />
          </div>

          <Card style={{ marginBottom: 11 }}>
            <Eyebrow style={{ marginBottom: 14 }}>Acerto por confiança prevista</Eyebrow>
            {Object.entries(summary.byConfidenceBand).map(([band, v]) => {
              const rate = v.t > 0 ? Math.round((v.g / v.t) * 1000) / 10 : 0;
              const c = rate >= 60 ? C.acc : rate >= 45 ? C.gold : C.orange;
              const lbl = band === '70+' ? '≥70%' : band === '55-69' ? '55–69%' : '<55%';
              return (
                <div key={band} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
                  <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 600, color: C.text2, minWidth: 52 }}>{lbl}</div>
                  <div style={{ flex: 1 }}><Bar pct={rate} color={c} height={14} /></div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: c, minWidth: 76, textAlign: 'right' }}>{rate}% ({v.g}/{v.t})</div>
                </div>
              );
            })}
          </Card>

          {summary.bySport.length > 0 && (
            <Card style={{ marginBottom: 22 }}>
              <Eyebrow style={{ marginBottom: 12 }}>Por modalidade</Eyebrow>
              {summary.bySport.map(s => (
                <div key={s.sport} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13.5, color: C.text }}>{ICON[s.sport] || '🎯'} {s.sport}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontFamily: C.mono, fontSize: 11, color: C.text3 }}>{s.green}G/{s.red}R</span>
                    <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: s.hitRate >= 50 ? C.acc : C.orange, minWidth: 44, textAlign: 'right' }}>{s.hitRate}%</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <Eyebrow style={{ marginBottom: 12 }}>Histórico diário</Eyebrow>

      {results.length === 0 && (
        <Empty icon="◈">Ainda sem dias validados.<br />Faz uma "Análise do Dia" e a validação corre<br />automaticamente à meia-noite — ou usa os botões acima.</Empty>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {results.map(day => {
          const s = day.stats || {};
          const open = openDay === day.data;
          const c = s.hitRate >= 50 ? C.acc : s.hitRate >= 35 ? C.gold : C.red;
          return (
            <Card key={day.data} pad={0} accent={c}>
              <div onClick={() => setOpenDay(open ? null : day.data)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600, letterSpacing: -.2 }}>{fmtDate(day.data)}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3, marginTop: 2 }}>{s.green || 0}G · {s.red || 0}R · {s.void || 0}N · {s.total || 0} mercados</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: C.mono, fontSize: 19, fontWeight: 700, color: c }}>{s.hitRate || 0}%</div>
                    <div style={{ fontFamily: C.mono, fontSize: 10, color: (s.profitUnits || 0) >= 0 ? C.acc : C.red, marginTop: 1 }}>{(s.profitUnits || 0) >= 0 ? '+' : ''}{s.profitUnits || 0}u</div>
                  </div>
                  <span style={{ color: C.text4, fontSize: 13 }}>{open ? '▲' : '▼'}</span>
                </div>
              </div>
              {open && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  {(day.jogos_validados || []).map((j, i) => (
                    <div key={i} style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                        <div style={{ fontSize: 13, color: C.text }}>{ICON[j.modalidade] || '🎯'} {j.jogo}</div>
                        {j.resultado_real && <Tag label={j.resultado_real} color={C.text3} />}
                      </div>
                      {(j.mercados || []).map((mk, k) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.text2 }}>{mk.mercado} <span style={{ color: C.blue }}>@{mk.odd}</span> <span style={{ color: C.text4 }}>({mk.confianca}%)</span></span>
                          <Tag label={RES_LBL[mk.resultado] || '?'} color={RES_C[mk.resultado] || C.text3} />
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ marginTop: 12 }}><Button variant="ghost" full size="sm" disabled={validating} onClick={() => run(day.data)}>{validating ? 'A revalidar…' : '⟳ Revalidar este dia'}</Button></div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
