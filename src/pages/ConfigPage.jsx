import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { getConfig, saveConfig, deleteAllBets } from '../lib/db';
import { C, Card, Eyebrow, Button, Loader } from '../components/ui';

const COLORS = ['#00e58a', '#4d8dff', '#ffc94d', '#ff8a4d', '#b07dff', '#00bcd4', '#f06292', '#9ccc65'];
const newBm = () => ({ id: Date.now().toString(), name: '', initialBudget: 100, color: '#00e58a' });

export default function ConfigPage() {
  const user = useAuth();
  const [bms, setBms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { getConfig(user.uid).then(cfg => { setBms(cfg.bookmakers || []); setLoading(false); }); }, []);

  const save = async () => { setSaving(true); await saveConfig(user.uid, { bookmakers: bms }); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const updBm = (id, k, v) => setBms(prev => prev.map(b => b.id === id ? { ...b, [k]: v } : b));
  const addBm = () => setBms(prev => [...prev, newBm()]);
  const remBm = (id) => setBms(prev => prev.filter(b => b.id !== id));
  const purge = async () => {
    if (!confirm('Tens a certeza? Elimina TODAS as apostas permanentemente.')) return;
    if (!confirm('Confirmação final: eliminar todo o histórico?')) return;
    setDeleting(true); await deleteAllBets(user.uid); setDeleting(false); alert('Histórico eliminado.');
  };

  if (loading) return <Loader />;

  return (
    <div className="stagger">
      <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: -.7, marginBottom: 22 }}>Configurações</h1>

      <Card style={{ marginBottom: 16 }}>
        <Eyebrow style={{ marginBottom: 16 }}>Casas de apostas</Eyebrow>

        {bms.length === 0 && <div style={{ fontFamily: C.mono, fontSize: 12, color: C.text3, marginBottom: 14, textAlign: 'center', padding: '8px 0' }}>Nenhuma casa configurada.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 14 }}>
          {bms.map(bm => (
            <div key={bm.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `2.5px solid ${bm.color}`, borderRadius: 'var(--r-sm)', padding: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 11, marginBottom: 12 }}>
                <Field label="Nome da casa"><input value={bm.name} onChange={e => updBm(bm.id, 'name', e.target.value)} placeholder="Betclic, Bet365…" style={inp} /></Field>
                <Field label="Budget (€)"><input type="number" value={bm.initialBudget} onChange={e => updBm(bm.id, 'initialBudget', parseFloat(e.target.value) || 0)} style={inp} /></Field>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <label style={lbl}>Cor</label>
                  <div style={{ display: 'flex', gap: 7 }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => updBm(bm.id, 'color', c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: bm.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transition: 'transform .12s' }} />
                    ))}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => remBm(bm.id)}>Remover</Button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}><Button variant="dashed" full onClick={addBm}>+ Adicionar casa de apostas</Button></div>
        <Button variant="primary" full onClick={save} disabled={saving}>{saved ? '✓ Guardado' : saving ? 'A guardar…' : '◈ Guardar configurações'}</Button>
      </Card>

      <Card accent={C.red} style={{ background: 'linear-gradient(165deg, rgba(255,77,109,0.05), rgba(255,77,109,0.02))' }}>
        <Eyebrow color={C.red} style={{ marginBottom: 12 }}>Zona de perigo</Eyebrow>
        <div style={{ fontFamily: C.mono, fontSize: 12, color: C.text3, marginBottom: 14, lineHeight: 1.7 }}>Elimina permanentemente todo o histórico de apostas. Não pode ser desfeito.</div>
        <Button variant="danger" full onClick={purge} disabled={deleting}>{deleting ? 'A eliminar…' : '🗑 Eliminar todo o histórico'}</Button>
      </Card>
    </div>
  );
}

const lbl = { display: 'block', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: .8, textTransform: 'uppercase', marginBottom: 6 };
const inp = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-xs)', padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 13 };
function Field({ label, children }) { return <div><label style={lbl}>{label}</label>{children}</div>; }
