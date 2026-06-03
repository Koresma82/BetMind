import { useState, useEffect } from 'react';

// Modal de confirmação de aposta. Recebe a sugestão (jogo + mercado), as casas
// de apostas do utilizador, e devolve a aposta confirmada via onConfirm.
export default function BetModal({ open, suggestion, bookmakers, onClose, onConfirm }) {
  const [odd, setOdd] = useState('');
  const [amount, setAmount] = useState('');
  const [bookmakerId, setBookmakerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && suggestion) {
      setOdd(suggestion.market?.odd?.toString().replace(/[^\d.]/g, '') || '');
      setAmount('');
      setBookmakerId(bookmakers?.[0]?.id || '');
      setErr('');
    }
  }, [open, suggestion, bookmakers]);

  if (!open || !suggestion) return null;

  const { jogo, market } = suggestion;
  const oddN = parseFloat(odd) || 0;
  const amtN = parseFloat(amount) || 0;
  const retorno = (oddN * amtN);
  const lucro = retorno - amtN;
  const bm = bookmakers?.find(b => b.id === bookmakerId);
  const saldo = bm?.balance ?? bm?.initialBudget ?? null;
  const insufficient = saldo != null && amtN > saldo;
  const valid = oddN >= 1 && amtN > 0 && bookmakerId && !insufficient;

  const confirm = async () => {
    if (!valid) return;
    setSaving(true); setErr('');
    try {
      await onConfirm({
        match: `${jogo.casa} vs ${jogo.fora}`,
        competition: jogo.competicao || '',
        sport: jogo.modalidade || 'Outro',
        market: market.mercado,
        odd: oddN,
        amount: amtN,
        bookmakerId,
        source: 'ai',
        aiConfidence: market.confianca ?? null,
        eventDate: new Date().toISOString().split('T')[0]
      });
      onClose();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.7)',
      backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      animation:'fadeIn .15s ease'
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'100%', maxWidth:420,
        background:'linear-gradient(165deg, #161c27, #11161f)',
        border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:22,
        boxShadow:'0 20px 60px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#00e58a', letterSpacing:1.5, marginBottom:4 }}>CONFIRMAR APOSTA</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#eef2f7' }}>{jogo.casa} vs {jogo.fora}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#5d6b7f', marginTop:2 }}>{jogo.competicao}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#5d6b7f', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        <div style={{ background:'rgba(0,229,138,0.06)', border:'1px solid rgba(0,229,138,0.2)', borderRadius:10, padding:'10px 12px', marginBottom:16 }}>
          <div style={{ fontSize:13, color:'#eef2f7', fontWeight:600 }}>{market.mercado}</div>
          {market.confianca != null && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#9aa7b8', marginTop:2 }}>Confiança IA: {market.confianca}%{market.sinal ? ` · ${market.sinal}` : ''}</div>}
        </div>

        <Field label="Casa de apostas">
          {bookmakers?.length ? (
            <select value={bookmakerId} onChange={e=>setBookmakerId(e.target.value)} style={inp}>
              {bookmakers.map(b => <option key={b.id} value={b.id}>{b.name}{(b.balance!=null||b.initialBudget!=null) ? ` (saldo ${(b.balance ?? b.initialBudget).toFixed(0)}€)` : ''}</option>)}
            </select>
          ) : <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#ffc94d' }}>⚠ Cria uma casa de apostas em Config primeiro.</div>}
        </Field>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Odd (confirma/corrige)">
            <input type="number" step="0.01" min="1" value={odd} onChange={e=>setOdd(e.target.value)} style={inp} />
          </Field>
          <Field label="Valor a apostar (€)">
            <input type="number" step="0.5" min="0" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="10" style={inp} autoFocus />
          </Field>
        </div>

        {amtN > 0 && oddN >= 1 && (
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#9aa7b8', margin:'4px 2px 14px' }}>
            <span>Retorno: <strong style={{ color:'#00e58a' }}>{retorno.toFixed(2)}€</strong></span>
            <span>Lucro: <strong style={{ color: lucro>=0?'#00e58a':'#ff4d6d' }}>{lucro>=0?'+':''}{lucro.toFixed(2)}€</strong></span>
          </div>
        )}

        {insufficient && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#ff4d6d', marginBottom:12 }}>Saldo insuficiente nesta casa ({saldo.toFixed(2)}€).</div>}
        {err && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#ff4d6d', marginBottom:12 }}>{err}</div>}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={confirm} disabled={!valid||saving} style={{ ...btnPrimary, opacity:(!valid||saving)?0.5:1, cursor:(!valid||saving)?'default':'pointer' }}>
            {saving ? 'A guardar…' : '✓ Confirmar aposta'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = { width:'100%', background:'#0d1219', border:'1px solid rgba(255,255,255,0.11)', borderRadius:8, padding:'10px 12px', color:'#eef2f7', fontFamily:"'JetBrains Mono',monospace", fontSize:13 };
const lbl = { display:'block', fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#5d6b7f', letterSpacing:.8, textTransform:'uppercase', marginBottom:6 };
const btnGhost = { flex:1, padding:'12px', background:'#161c27', border:'1px solid rgba(255,255,255,0.11)', borderRadius:8, color:'#9aa7b8', cursor:'pointer', fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:600 };
const btnPrimary = { flex:2, padding:'12px', background:'linear-gradient(135deg, rgba(0,229,138,0.2), rgba(0,229,138,0.1))', border:'1px solid rgba(0,229,138,0.45)', borderRadius:8, color:'#00e58a', fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:600 };
function Field({ label, children }) { return <div style={{ marginBottom:14 }}><label style={lbl}>{label}</label>{children}</div>; }
