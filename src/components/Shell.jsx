import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../App.jsx';
import { DemoTag, Dropdown, Icon, RankEmblem, initials, rankMeta } from './ui.jsx';
import { CommandPalette, DailyAnnouncement, Notifications, Onboarding } from './Layers.jsx';
import { useApi } from './ui.jsx';

export const Logo = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  <defs><linearGradient id="lg-cb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--accent-2)" /><stop offset="1" stopColor="var(--accent-deep)" /></linearGradient></defs>
  <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="var(--surface-2)" stroke="var(--line-2)" />
  <path d="M8.5 22.5V10l7.5 4.3L23.5 10v12.5" fill="none" stroke="url(#lg-cb)" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />
  <circle cx="16" cy="14.3" r="2.3" fill="var(--accent)" /><circle cx="16" cy="14.3" r="5" fill="none" stroke="var(--accent)" strokeOpacity="0.25" />
</svg>;
export const Wordmark = ({ size = 17 }) => <span className="brand" style={{ padding: 0, fontSize: size }}><Logo size={size + 7} /><span>Consult <b>Brain</b></span></span>;

const STUDENT = [
  ['Investigate', [['/', 'Command Centre', 'command'], ['/vault', 'Case Vault', 'vault'], ['/daily', 'Daily Diagnostic', 'daily'], ['/arena', 'Arena', 'arena']]],
  ['Compete', [['/leaderboards', 'Leaderboards', 'board'], ['/progress', 'My Progress', 'progress'], ['/certificates', 'Certificates', 'cert']]],
  ['Learn together', [['/classroom', 'Classroom', 'class'], ['/profile', 'Profile', 'user']]],
];
const PROF = [['Teach', [['/classroom', 'Classroom', 'class'], ['/vault', 'Case Vault', 'vault'], ['/leaderboards', 'Leaderboards', 'board']]]];

export default function Shell() {
  const { user, signOut, theme, setTheme, ai } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const outlet = useOutlet();
  const groups = user.role === 'professor' ? PROF : STUDENT; const rm = rankMeta(user.rank);
  const { data: dash } = useApi(user.role === 'student' ? '/dashboard' : null, [user.xp]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  const isOn = (to, active) => active || (to === '/profile' && loc.pathname.startsWith('/u/' + user.id)) || (to === '/arena' && loc.pathname.startsWith('/arena'));
  const out = async () => { await signOut(); nav('/'); };
  return (
    <div className="shell">
      <nav className="side" aria-label="Primary">
        <div style={{ padding: '4px 8px 18px' }}><Wordmark /></div>
        {groups.map(([label, items]) => <React.Fragment key={label}><div className="nav-label eyebrow">{label}</div>
          {items.map(([to, text, icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isOn(to, isActive) ? 'on' : ''}`}>{({ isActive }) => <>{isOn(to, isActive) && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}<Icon name={icon} size={17} /><span>{text}</span></>}</NavLink>)}</React.Fragment>)}
        <div className="side-foot" style={{ marginTop: 'auto', paddingTop: 16 }}>
          {user.role === 'student' && <button className="panel spot" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); }} onClick={() => nav('/progress')} style={{ width: '100%', padding: 12, textAlign: 'left', marginBottom: 10, '--rank': rm.color }}>
            <span className="row gap-10"><RankEmblem rank={user.rank} size={34} glow /><span style={{ minWidth: 0 }}><span className="eyebrow" style={{ color: rm.color, display: 'block' }}>{user.rankName}</span><span className="mono small">{user.xp.toLocaleString('en-IN')} XP</span></span></span>
            {dash?.rank?.next && <><div className="bar thin shimmer mt-8"><i style={{ width: `${dash.rank.progress * 100}%`, background: `linear-gradient(90deg, ${rm.color}, var(--accent-2))` }} /></div><span className="xs muted" style={{ display: 'block', marginTop: 5 }}>{(dash.rank.next.xp - user.xp).toLocaleString('en-IN')} XP to {dash.rank.next.name}</span></>}
          </button>}
          <div className="xs muted" style={{ padding: '0 10px 6px', lineHeight: 1.45 }}>Evaluation: {ai ? 'rubric engine + AI-assisted' : 'deterministic rubric engine'}</div>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <div className="row gap-10" style={{ minWidth: 0 }}>
            <button className="search-trigger" onClick={() => window.dispatchEvent(new Event('cb-palette'))} aria-label="Open command palette"><Icon name="search" size={14} /><span className="grow hide-md" style={{ textAlign: 'left' }}>Search cases, pages, actions</span><span className="kbd">⌘K</span></button>
            {user.demo && <span className="row gap-6 xs muted hide-sm"><DemoTag /><span>Seeded demo account</span></span>}
          </div>
          <div className="row gap-10">
            {user.role === 'student' && <>
              <button className="xp-pill" onClick={() => nav('/progress')} title="Streak, XP and rank"><RankEmblem rank={user.rank} size={22} /><span className="row gap-4 small"><Icon name="flame" size={14} style={{ color: user.streak ? 'var(--warn)' : 'var(--faint)' }} /><span className="mono">{user.streak}</span></span><span style={{ width: 1, height: 14, background: 'var(--line-2)' }} /><span className="mono small acc">{user.xp.toLocaleString('en-IN')}</span><span className="xs muted hide-sm">XP</span></button>
              <Notifications /></>}
            <Dropdown width={250} trigger={({ toggle, open }) => <button className={`icon-btn ${open ? 'on' : ''}`} style={{ width: 'auto', padding: '0 6px 0 3px', gap: 8, display: 'flex' }} onClick={toggle} aria-haspopup="menu" aria-expanded={open}><span className="avatar" style={{ borderColor: user.role === 'student' ? rm.color : undefined }}>{initials(user.name)}</span><span className="small hide-sm">{user.name.split(' ')[0]}</span><Icon name="chevron" size={13} /></button>}>
              <div style={{ padding: '8px 10px 10px' }}><div style={{ fontWeight: 600 }}>{user.name}</div><div className="xs muted">{user.university} · {user.role === 'professor' ? 'Professor' : user.rankName}</div></div>
              <div className="menu-sep" />
              {user.role === 'student' && <><button data-close className="menu-item" onClick={() => nav(`/u/${user.id}`)}><Icon name="user" size={15} />Profile</button><button data-close className="menu-item" onClick={() => nav('/progress')}><Icon name="progress" size={15} />My progress</button><button data-close className="menu-item" onClick={() => nav('/certificates')}><Icon name="cert" size={15} />Certificates</button></>}
              <button data-close className="menu-item" onClick={() => window.dispatchEvent(new Event('cb-palette'))}><Icon name="search" size={15} /><span className="grow">Command palette</span><span className="kbd">⌘K</span></button>
              <button data-close className="menu-item" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
              <div className="menu-sep" /><button data-close className="menu-item" onClick={out}><Icon name="logout" size={15} />Sign out</button>
            </Dropdown>
          </div>
        </header>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }} transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}>{outlet}</motion.div>
        </AnimatePresence>
      </div>
      <CommandPalette user={user} theme={theme} setTheme={setTheme} signOut={out} />
      <Onboarding user={user} />
      {dash && <DailyAnnouncement user={user} daily={dash.daily} />}
    </div>
  );
}
