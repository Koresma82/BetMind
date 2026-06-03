import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { C } from './ui';

const NAV = [
  { to: '/',          icon: '◫', label: 'Painel'     },
  { to: '/analise',   icon: '◎', label: 'Análise'    },
  { to: '/previsoes', icon: '◈', label: 'IA'         },
  { to: '/historico', icon: '☰', label: 'Apostas'    },
  { to: '/relatorio', icon: '◧', label: 'Relatório'  },
  { to: '/config',    icon: '⚙', label: 'Config'     },
];

export default function Layout() {
  const nav = useNavigate();
  const handleSignOut = () => signOut(auth).then(() => nav('/login'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,14,20,0.72)', borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 58
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--acc), #00b56e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#06120c', boxShadow: '0 0 16px var(--acc-glow)'
          }}>◈</div>
          <div style={{ fontFamily: C.font, fontSize: 16, fontWeight: 700, letterSpacing: -.3, color: C.text }}>
            BetMind<span style={{ color: C.acc }}>.</span><span style={{ color: C.text3, fontWeight: 500, fontSize: 12, marginLeft: 4, fontFamily: C.mono, letterSpacing: 1 }}>PRO</span>
          </div>
        </div>
        <button onClick={handleSignOut} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border-2)',
          borderRadius: 8, padding: '6px 13px', color: C.text3, cursor: 'pointer',
          fontFamily: C.mono, fontSize: 11, fontWeight: 500, transition: 'all .16s'
        }}
        onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = 'rgba(255,77,109,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
        >sair</button>
      </header>

      <main style={{ flex: 1, padding: '22px 16px 96px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(10,14,20,0.82)', borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        display: 'flex', padding: '6px 6px max(6px, env(safe-area-inset-bottom))', maxWidth: 860, margin: '0 auto'
      }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, padding: '8px 0', borderRadius: 12,
            color: isActive ? C.acc : C.text4, textDecoration: 'none', transition: 'all .16s',
            background: isActive ? 'var(--acc-dim)' : 'transparent'
          })}>
            {({ isActive }) => (
              <>
                <span style={{ fontSize: 17, lineHeight: 1, filter: isActive ? 'drop-shadow(0 0 6px var(--acc-glow))' : 'none' }}>{icon}</span>
                <span style={{ fontFamily: C.mono, fontSize: 8.5, fontWeight: 600, letterSpacing: .3 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
