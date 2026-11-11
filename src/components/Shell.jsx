import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { DemoTag, Icon, RankEmblem, initials } from './ui.jsx';

export const Logo = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--surface-3)" /><path d="M9 22V10l7 4 7-4v12" fill="none" stroke="var(--accent)" strokeWidth="2.200" strokeLinejoin="round" /><circle cx="16" cy="14" r="2.200" fill="var(--accent)" /></svg>;

const STUDENT = [
  ['Investigate', [['/', 'Command Centre', 'command'], ['/vault', 'Case Vault', 'vault'], ['/daily', 'Daily Diagnostic', 'daily'], ['/arena', 'Arena', 'arena']]],
  ['Compete', [['/leaderboards', 'Leaderboards', 'board'], ['/progress', 'My Progress', 'progress'], ['/certificates', 'Certificates', 'cert']]],
  ['Learn together', [['/classroom', 'Classroom', 'class'], ['/profile', 'Profile', 'user']]],
];
const PROF = [['Teach', [['/classroom', 'Classroom', 'class'], ['/vault', 'Case Vault', 'vault'], ['/leaderboards', 'Leaderboards', 'board']]]];

export default function Shell() {
  const { user, signOut, theme, setTheme, ai } = useAuth(); const nav = useNavigate();
  const groups = user.role === 'professor' ? PROF : STUDENT;
  return (
    <div className="shell">
      <nav className="side" aria-label="Primary">
        <div className="brand"><Logo /><span>Consult<b>Brain</b></span></div>
        {groups.map(([label, items]) => <React.Fragment key={label}><div className="nav-label eyebrow">{label}</div>
          {items.map(([to, text, icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive || (to === '/profile' && location.pathname.startsWith('/u/' + user.id)) ? 'on' : ''}`}><Icon name={icon} size={17} /><span>{text}</span></NavLink>)}</React.Fragment>)}
        <div className="side-foot" style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div className="xs muted" style={{ padding: '0 10px 10px', lineHeight: 1.45 }}>Evaluation: {ai ? 'rubric engine + AI-assisted' : 'deterministic rubric engine'}</div>
          <button className="nav-item" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /><span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
          <button className="nav-item" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer' }} onClick={async () => { await signOut(); nav('/'); }}><Icon name="logout" size={17} /><span>Sign out</span></button>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <div className="row gap-6 small muted hide-sm">{user.demo && <><DemoTag /><span>Demo account — progress shown is seeded sample data until you play.</span></>}</div>
          <div className="row gap-16" style={{ marginLeft: 'auto' }}>
            {user.role === 'student' && <>
              <span className="row gap-6 small" title="Current streak"><Icon name="flame" size={15} style={{ color: user.streak ? 'var(--warn)' : 'var(--faint)' }} /><span className="mono">{user.streak}</span></span>
              <span className="row gap-6 small" title="Total XP"><span className="mono acc">{user.xp.toLocaleString('en-IN')}</span><span className="muted xs">XP</span></span>
              <span className="row gap-6 small"><RankEmblem rank={user.rank} size={22} /><span className="hide-sm">{user.rankName}</span></span></>}
            <button className="row gap-6" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => nav(user.role === 'student' ? `/u/${user.id}` : '/classroom')}><span className="avatar">{initials(user.name)}</span><span className="small hide-sm">{user.name}</span></button>
            <button className="btn ghost sm icon" style={{ display: 'none' }} aria-label="Sign out" onClick={signOut}><Icon name="logout" /></button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
