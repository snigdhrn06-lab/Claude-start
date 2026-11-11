import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { post } from '../api.js';
import { useAuth } from '../App.jsx';
import { Field, Icon, RankEmblem, RANKS, Seg, spotlight } from '../components/ui.jsx';
import { Wordmark } from '../components/Shell.jsx';

// A live, looping illustration of the core mechanic: confidence re-allocating as evidence arrives.
// These are illustrative numbers in the hero, labelled as such; they are not user data.
const FRAMES = [
  { ev: 'Opening view', v: [25, 25, 20, 15, 15] },
  { ev: 'Consolidated P&L', v: [34, 22, 18, 14, 12] },
  { ev: 'Revenue by channel', v: [44, 28, 12, 9, 7] },
  { ev: 'Contribution per order', v: [58, 27, 8, 4, 3] },
];
const LABELS = ['Channel economics', 'Cannibalisation', 'New-store costs', 'Input inflation', 'Competition'];
const COLS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c5)', 'var(--c6)'];
function BeliefDemo() {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF((x) => (x + 1) % FRAMES.length), 2200); return () => clearInterval(t); }, []);
  return <div className="panel" style={{ overflow: 'hidden' }}>
    <div className="panel-h"><span className="eyebrow acc row gap-6"><span className="live-dot" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />Belief ledger · illustration</span><span className="mono xs muted">{f + 1}/{FRAMES.length}</span></div>
    <div className="panel-b">
      <AnimatePresence mode="wait"><motion.div key={f} className="small t2 mb-12" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>{f === 0 ? 'Committing an opening view…' : <>Evidence received: <b style={{ color: 'var(--text)' }}>{FRAMES[f].ev}</b></>}</motion.div></AnimatePresence>
      <div className="col" style={{ gap: 9 }}>{LABELS.map((l, i) => <div key={l} className="row gap-10 small"><span className="t2" style={{ width: 128 }}>{l}</span><div className="bar grow" style={{ height: 8 }}><motion.i animate={{ width: `${FRAMES[f].v[i]}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} style={{ background: COLS[i], boxShadow: `0 0 10px ${COLS[i]}` }} /></div><motion.span key={FRAMES[f].v[i]} className="mono xs" style={{ width: 22, textAlign: 'right' }} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }}>{FRAMES[f].v[i]}</motion.span></div>)}</div>
    </div></div>;
}

export default function Login() {
  const { signIn, theme, setTheme } = useAuth(); const nav = useNavigate();
  const [mode, setMode] = useState('demo'); const [busy, setBusy] = useState(''); const [err, setErr] = useState(null);
  const [f, setF] = useState({ name: '', email: '', password: '', university: '', role: 'student' });
  useEffect(() => { document.title = 'Consult Brain — Investigate. Defend. Improve.'; }, []);
  const go = async (path, body, key) => { setBusy(key); setErr(null); try { const d = await post(path, body); signIn(d); nav(d.user.role === 'professor' ? '/classroom' : '/'); } catch (e) { setErr(e); } setBusy(''); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rise = (i) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.6, ease: [0.22, 0.8, 0.24, 1] } });
  return (
    <div className="landing">
      <section className="landing-l">
        <svg viewBox="0 0 800 600" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.6, pointerEvents: 'none' }} aria-hidden="true">
          <path d="M-20 470 C 160 430, 260 500, 420 410 S 680 330, 820 360" fill="none" stroke="var(--accent)" strokeOpacity="0.3" strokeWidth="1.4" />
          <path d="M-20 470 C 160 430, 260 500, 420 410 S 680 330, 820 360" fill="none" stroke="#fff" strokeOpacity="0.25" className="data-line" />
          <path d="M-20 540 C 200 520, 360 560, 560 500 S 760 470, 820 480" fill="none" stroke="var(--signal)" strokeOpacity="0.2" strokeDasharray="2 7" />
        </svg>
        <motion.div className="row between" style={{ position: 'relative' }} {...rise(0)}><Wordmark size={19} />
          <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button></motion.div>
        <div style={{ position: 'relative' }}>
          <motion.div className="eyebrow acc mb-16" {...rise(1)}>A competitive consulting investigation lab</motion.div>
          <motion.h1 className="hero-title" {...rise(2)}>Find out what is <em>actually</em> happening. Then defend it.</motion.h1>
          <motion.p className="t2 mt-24" style={{ fontSize: 16.5, maxWidth: 560, lineHeight: 1.65 }} {...rise(3)}>A client, a budget of analyst hours, and a room full of data you cannot afford to read in full. Consult Brain scores <b style={{ color: 'var(--text)' }}>how</b> you investigate — what you asked for, how your confidence moved, whether your numbers hold — and replays your trail beside an expert's.</motion.p>
          <div className="grid g12 mt-32" style={{ gap: 16, maxWidth: 820 }}>
            <motion.div className="s7" {...rise(4)}><BeliefDemo /></motion.div>
            <motion.div className="s5 col" style={{ gap: 10 }} {...rise(5)}>{[['target', 'Hypothesis-led', 'Commit confidence before you look.'], ['data', 'Evidence under budget', 'Every dataset costs hours.'], ['replay', 'Evidence Trail Replay', 'See where you should have changed your mind.']].map(([i, t, d]) => <div key={t} className="feature-tile row gap-10" style={{ padding: 12 }}><span className="empty-ico" style={{ width: 34, height: 34, margin: 0, borderStyle: 'solid', borderColor: 'var(--accent-line)' }}><Icon name={i} size={15} /></span><div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div className="xs muted">{d}</div></div></div>)}</motion.div>
          </div>
        </div>
        <motion.div className="row wrap gap-16" style={{ position: 'relative' }} {...rise(6)}><span className="eyebrow">Ranks</span>{RANKS.map((r, i) => <motion.span key={r.id} className="row gap-6 xs" style={{ color: r.color }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.08 }}><RankEmblem rank={r.id} size={22} />{r.name}{i < RANKS.length - 1 && <Icon name="arrow" size={10} style={{ color: 'var(--faint)', marginLeft: 4 }} />}</motion.span>)}</motion.div>
      </section>
      <section className="landing-r">
        <motion.div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <h2 style={{ fontSize: 30 }}>Enter the lab</h2>
          <p className="small muted mt-4 mb-16">No account or API key is needed for the demo.</p>
          <Seg value={mode} onChange={(m) => { setMode(m); setErr(null); }} options={[{ id: 'demo', label: 'Demo' }, { id: 'login', label: 'Sign in' }, { id: 'register', label: 'Create account' }]} />
          <AnimatePresence mode="wait"><motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {mode === 'demo' ? <div className="col mt-16" style={{ gap: 10 }}>
            {[['student', 's', 'Continue as demo learner', 'Aanya Kapoor · Gold · seeded history, Brewly ready to investigate.', <RankEmblem key="e" rank="gold" size={30} glow />], ['professor', 'p', 'Continue as demo professor', 'A seeded class of 19 on Brewly: trails, distributions, grading.', <span key="i" className="empty-ico" style={{ width: 30, height: 30, margin: 0, borderStyle: 'solid', borderColor: 'var(--accent-line)' }}><Icon name="class" size={15} /></span>]].map(([role, key, title, sub, icon]) =>
              <button key={role} className="panel pad spot" onMouseMove={spotlight} style={{ textAlign: 'left', color: 'inherit' }} disabled={!!busy} onClick={() => go('/auth/demo', { role }, key)}>
                <div className="row between"><span className="row gap-10">{icon}<b style={{ fontSize: 14.5 }}>{busy === key ? 'Opening…' : title}</b></span><Icon name="arrow" className="acc" /></div>
                <div className="small muted mt-8">{sub}</div></button>)}
          </div> : <form className="col mt-16" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); go(mode === 'login' ? '/auth/login' : '/auth/register', f, 'f'); }}>
            {mode === 'register' && <><Field label="Full name" error={err?.fields?.name}><input className="input" value={f.name} onChange={set('name')} autoComplete="name" /></Field>
              <Field label="University or organisation"><input className="input" value={f.university} onChange={set('university')} /></Field>
              <Field label="I am a"><Seg value={f.role} onChange={(role) => setF({ ...f, role })} options={[{ id: 'student', label: 'Learner' }, { id: 'professor', label: 'Professor' }]} /></Field></>}
            <Field label="Email" error={err?.fields?.email}><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
            <Field label="Password" error={err?.fields?.password} hint={mode === 'register' ? 'At least 8 characters. Stored hashed on this server.' : null}><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>
            <button className="btn primary lg" disabled={!!busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>}</motion.div></AnimatePresence>
          <AnimatePresence>{err && !err.fields && <motion.div className="callout neg mt-12" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{err.message}</motion.div>}</AnimatePresence>
          <p className="xs muted mt-24">Consult Brain cases are original fictional simulations. Certificates are Consult Brain achievements, not academic credentials, and are not issued or accredited by any university.</p>
        </motion.div>
      </section>
    </div>
  );
}
