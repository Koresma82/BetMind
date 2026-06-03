import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { C, Spinner } from '../components/ui';

const ALLOWED = import.meta.env.VITE_ALLOWED_EMAIL || 'koresma@gmail.com';

export default function LoginPage() {
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true); setErr('');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user.email !== ALLOWED) { await auth.signOut(); setErr('Acesso não autorizado para este email.'); }
    } catch (e) { setErr('Erro ao iniciar sessão: ' + e.message); }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      {/* Glow ambiente */}
      <div style={{ position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 480, background: 'radial-gradient(circle, rgba(0,229,138,0.10), transparent 65%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

      <div style={{ textAlign: 'center', animation: 'fadeUp .6s cubic-bezier(.2,.7,.3,1) forwards', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 24px',
          background: 'linear-gradient(135deg, var(--acc), #00a862)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, color: '#06120c', boxShadow: '0 0 40px var(--acc-glow), inset 0 1px 0 rgba(255,255,255,0.2)'
        }}>◈</div>

        <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.acc, letterSpacing: 4, marginBottom: 14, fontWeight: 600 }}>
          SISTEMA DE APOSTAS · IA
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: -1.5 }}>
          BetMind <span style={{ color: C.acc }}>PRO</span>
        </h1>
        <p style={{ color: C.text3, fontFamily: C.mono, fontSize: 12.5, marginBottom: 44, letterSpacing: .3 }}>
          Gestão de banca · Análise IA · Validação automática
        </p>

        <button onClick={login} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 12, margin: '0 auto', padding: '15px 30px',
          borderRadius: 14, background: 'linear-gradient(165deg, var(--surface-2), var(--surface))',
          border: '1px solid var(--border-2)', color: C.text, cursor: loading ? 'default' : 'pointer',
          fontSize: 14.5, fontWeight: 500, fontFamily: C.font, boxShadow: 'var(--shadow)', transition: 'all .2s'
        }}
        onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--acc-glow)'; } }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
        >
          {loading ? <Spinner size={18} /> : <svg width="19" height="19" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
          {loading ? 'A entrar...' : 'Entrar com Google'}
        </button>

        {err && <div style={{ marginTop: 22, color: C.red, fontFamily: C.mono, fontSize: 12 }}>{err}</div>}
      </div>
    </div>
  );
}
