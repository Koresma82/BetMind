import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';

import Layout        from './components/Layout';
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AnalisePage   from './pages/AnalisePage';
import PrevisoesPage from './pages/PrevisoesPage';
import HistoricoPage from './pages/HistoricoPage';
import RelatorioPage from './pages/RelatorioPage';
import ConfigPage    from './pages/ConfigPage';
import { Spinner } from './components/ui';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const ALLOWED = import.meta.env.VITE_ALLOWED_EMAIL || 'koresma@gmail.com';

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      if (u && u.email !== ALLOWED) { signOut(auth); setUser(null); }
      else setUser(u || null);
    });
  }, []);

  if (user === undefined) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={34} />
    </div>
  );

  return (
    <AuthCtx.Provider value={user}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index            element={<DashboardPage />} />
          <Route path="analise"   element={<AnalisePage />} />
          <Route path="previsoes" element={<PrevisoesPage />} />
          <Route path="historico" element={<HistoricoPage />} />
          <Route path="relatorio" element={<RelatorioPage />} />
          <Route path="config"    element={<ConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthCtx.Provider>
  );
}
