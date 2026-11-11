import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, getToken, post, setToken } from './api.js';
import { ToastHost, PageSkeleton } from './components/ui.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Vault from './pages/Vault.jsx';
import Investigation from './pages/Investigation.jsx';
import Replay from './pages/Replay.jsx';
import { Arena, Daily, Play } from './pages/Arena.jsx';
import Leaderboards from './pages/Leaderboards.jsx';
import Progress from './pages/Progress.jsx';
import { Certificates, Verify } from './pages/Certificates.jsx';
import Classroom from './pages/Classroom.jsx';
import Profile from './pages/Profile.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false); const [ai, setAi] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('cb_theme') || 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('cb_theme', theme); }, [theme]);
  const refresh = useCallback(async () => { if (!getToken()) { setUser(null); setReady(true); return; } try { const d = await api('/me'); setUser(d.user); setAi(d.ai); } catch { setUser(null); } setReady(true); }, []);
  useEffect(() => { refresh(); const out = () => setUser(null); window.addEventListener('cb-logout', out); return () => window.removeEventListener('cb-logout', out); }, [refresh]);
  const signIn = (d) => { setToken(d.token); setUser(d.user); };
  const signOut = async () => { try { await post('/auth/logout'); } catch {} setToken(null); setUser(null); };
  const loc = useLocation();
  if (!ready) return <PageSkeleton />;
  const ctx = { user, setUser, refresh, signIn, signOut, theme, setTheme, ai };
  const home = user?.role === 'professor' ? '/classroom' : '/';
  return (
    <AuthCtx.Provider value={ctx}><ToastHost>
      <Routes>
        <Route path="/verify/:code?" element={<Verify />} />
        {!user ? <Route path="*" element={<Login />} /> : <>
          <Route path="/case/:id" element={<Investigation />} />
          <Route element={<Shell />}>
            <Route path="/" element={user.role === 'professor' ? <Navigate to="/classroom" replace /> : <Dashboard />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/replay/:id" element={<Replay />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/arena/:mode" element={<Play key={loc.key} />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/classroom" element={<Classroom />} />
            <Route path="/u/:id" element={<Profile />} />
            <Route path="/profile" element={<Navigate to={`/u/${user.id}`} replace />} />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Route></>}
      </Routes>
    </ToastHost></AuthCtx.Provider>
  );
}
