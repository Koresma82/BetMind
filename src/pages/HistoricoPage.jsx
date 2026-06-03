import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { getConfig, getAllBets, addBet, updateBet, deleteBet } from '../lib/db';
import { C, Card, Eyebrow, Tag, Button, Segmented, Loader, Empty } from '../components/ui';

const MARKETS = ['1X2 - Casa', '1X2 - Empate', '1X2 - Fora', 'Dupla Chance', 'Handicap', 'Mais de 0.5 Golos', 'Mais de 1.5 Golos', 'Mais de 2.5 Golos', 'Mais de 3.5 Golos', 'Menos de 1.5 Golos', 'Menos de 2.5 Golos', 'Menos de 3.5 Golos', 'BTTS - Ambas Marcam', 'BTTS - Não', 'Mais de 8.5 Cantos', 'Menos de 9.5 Cantos', 'Mais de 3.5 Cartões', 'Menos de 3.5 Cartões', 'Primeiro Marcador', 'Marcador a Qualquer Momento', 'Múltipla', 'Outro'];
const STATUS = { pending: ['Pendente', C.gold], won: ['Ganhou', C.acc], lost: ['Perdeu', C.red], void: ['Nulo', C.text3] };
const emptyForm = { match: '', competition: '', bookmakerId: '', market: 'Mais de 2.5 Golos', amount: '', odd: '', notes: '' };

export default function HistoricoPage() {
  const user = useAuth();
  const [bms, setBms] = useState([]);
  const [bets, setBets] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('register');
  const [filter, setFilter] = useState({ bm: '', status: '' });

  const load = async () => {
    const [cfg, allBets] = await Promise.all([getConfig(user.uid), getAllBets(user.uid)]);
    const bmsData = cfg.bookmakers || [];
    setBms(bmsData);
    if (bmsData.length) setForm(f => ({ ...f, bookmakerId: f.bookmakerId || bmsData[0].id }));
    setBets(allBets); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.match || !form.bookmakerId || !form.amount || !form.odd) return;
    setSaving(true);
    await addBet(user.uid, { ...form, amount: parseFloat(form.amount), odd: parseFloat(form.odd) });
    setForm({ ...emptyForm, bookmakerId: form.bookmakerId });
    await load(); setTab('history'); setSaving(false);
  };
  const mark = async (id, status) => { await updateBet(user.uid, id, { status }); load(); };
  const remove = async (id) => { if (!confirm('Eliminar esta aposta?')) return; await deleteBet(user.uid, id); load(); };

  const filtered = useMemo(() => bets.filter(b => (!filter.bm || b.bookmakerId === filter.bm) && (!filter.status || b.status === filter.status)), [bets, filter]);
  const valid = form.match && form.bookmakerId && form.amount && form.odd;

  if (loading) return <Loader />;

  return (
    <div className="stagger">
      <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: -.7, marginBottom: 18 }}>Apostas</h1>
      <Segmented tabs={[['register', '＋ Registar'], ['history', '☰ Histórico']]} value={tab} onChange={setTab} />

      {tab === 'register' && (
        <Card>
          {bms.length === 0 && <div style={{ fontFamily: C.mono, fontSize: 12, color: C.gold, marginBottom: 16 }}>⚠ Configura as casas de apostas primeiro</div>}
          <Field label="Jogo / evento"><input value={form.match} onChange={e => setF('match', e.target.value)} placeholder="Benfica vs Porto" style={inp} /></Field>
          <Field label="Competição (opcional)"><input value={form.competition} onChange={e => setF('competition', e.target.value)} placeholder="Liga Portugal" style={inp} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <Field label="Casa"><select value={form.bookmakerId} onChange={e => setF('bookmakerId', e.target.value)} style={inp}>{bms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Mercado"><select value={form.market} onChange={e => setF('market', e.target.value)} style={inp}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <Field label="Valor (€)"><input type="number" step="0.5" min="0" value={form.amount} onChange={e => setF('amount', e.target.value)} placeholder="10.00" style={inp} /></Field>
            <Field label="Odd"><input type="number" step="0.01" min="1" value={form.odd} onChange={e => setF('odd', e.target.value)} placeholder="2.10" style={inp} /></Field>
          </div>
          {form.amount && form.odd && (
            <div style={{ fontFamily: C.mono, fontSize: 12, color: C.acc, marginBottom: 14, padding: '8px 12px', background: 'var(--acc-dim)', borderRadius: 'var(--r-xs)' }}>
              Retorno: {(parseFloat(form.amount || 0) * parseFloat(form.odd || 1)).toFixed(2)}€ · lucro {((parseFloat(form.amount || 0) * parseFloat(form.odd || 1)) - parseFloat(form.amount || 0)).toFixed(2)}€
            </div>
          )}
          <Field label="Notas (opcional)"><textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Análise, motivo…" style={{ ...inp, resize: 'vertical' }} /></Field>
          <Button variant="primary" full onClick={submit} disabled={saving || !valid}>{saving ? 'A guardar…' : '◈ Registar aposta'}</Button>
        </Card>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
            <select value={filter.bm} onChange={e => setFilter(f => ({ ...f, bm: e.target.value }))} style={inp}><option value="">Todas as casas</option>{bms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} style={inp}><option value="">Todos os estados</option><option value="pending">Pendente</option><option value="won">Ganhou</option><option value="lost">Perdeu</option><option value="void">Nulo</option></select>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.text3, marginBottom: 12, letterSpacing: 1 }}>{filtered.length} APOSTAS</div>
          {filtered.length === 0 && <Empty icon="○">Sem apostas</Empty>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {filtered.map(b => {
              const bm = bms.find(x => x.id === b.bookmakerId);
              const ts = b.createdAt?.toDate?.() || new Date();
              const pot = ((b.amount || 0) * (b.odd || 1)).toFixed(2);
              const pft = b.status === 'won' ? (b.amount * (b.odd - 1)).toFixed(2) : b.status === 'lost' ? (-b.amount).toFixed(2) : null;
              const [lbl, col] = STATUS[b.status] || STATUS.pending;
              return (
                <Card key={b.id} pad={14} accent={col} hover>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 600, letterSpacing: -.2 }}>{b.match}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 600, color: b.status === 'won' ? C.acc : b.status === 'lost' ? C.red : C.text }}>{b.status === 'pending' ? `${(b.amount || 0).toFixed(0)}€` : pft ? `${pft > 0 ? '+' : ''}${pft}€` : ''}</div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3, marginBottom: 9 }}>{b.market} · @{b.odd} · {(b.amount || 0).toFixed(0)}€ → {pot}€ · {bm?.name || '?'}</div>
                  {b.notes && <div style={{ fontSize: 12, color: C.text2, marginBottom: 9, lineHeight: 1.5 }}>{b.notes}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: C.mono, fontSize: 10, color: C.text4 }}>{ts.toLocaleDateString('pt-PT')} {ts.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {b.status === 'pending' && <>
                        <Mini c={C.acc} onClick={() => mark(b.id, 'won')}>✓</Mini>
                        <Mini c={C.red} onClick={() => mark(b.id, 'lost')}>✗</Mini>
                        <Mini c={C.text3} onClick={() => mark(b.id, 'void')}>○</Mini>
                      </>}
                      {b.status !== 'pending' && <Tag label={lbl} color={col} />}
                      <Mini c={C.red} onClick={() => remove(b.id)}>🗑</Mini>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: 'block', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: .8, textTransform: 'uppercase', marginBottom: 6 };
const inp = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-xs)', padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 13 };
function Field({ label, children }) { return <div style={{ marginBottom: 12 }}><label style={lbl}>{label}</label>{children}</div>; }
function Mini({ c, onClick, children }) { return <button onClick={onClick} style={{ background: `${c}18`, border: `1px solid ${c}3a`, borderRadius: 7, padding: '4px 9px', color: c, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>{children}</button>; }
