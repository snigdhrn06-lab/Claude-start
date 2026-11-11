import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../api.js';
import { useAuth } from '../App.jsx';
import { Field, Icon, RankEmblem, RANKS, Seg } from '../components/ui.jsx';
import { Logo } from '../components/Shell.jsx';

export default function Login() {
  const { signIn, theme, setTheme } = useAuth(); const nav = useNavigate();
  const [mode, setMode] = useState('demo'); const [busy, setBusy] = useState(''); const [err, setErr] = useState(null);
  const [f, setF] = useState({ name: '', email: '', password: '', university: '', role: 'student' });
  const go = async (path, body, key) => { setBusy(key); setErr(null); try { const d = await post(path, body); signIn(d); nav(d.user.role === 'professor' ? '/classroom' : '/'); } catch (e) { setErr(e); } setBusy(''); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="landing">
      <section className="landing-l">
        <div className="row between"><div className="brand" style={{ padding: 0 }}><Logo size={26} /><span style={{ fontSize: 18 }}>Consult<b>Brain</b></span></div>
          <button className="btn ghost sm icon" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button></div>
        <div className="stagger">
          <div className="eyebrow acc mb-16">A consulting investigation laboratory</div>
          <h1 className="hero">Investigate real business problems. Discover what is <em>actually</em> happening. Defend your decision.</h1>
          <p className="t2 mt-16" style={{ fontSize: 16, maxWidth: 560, lineHeight: 1.6 }}>You get a client, a limited budget of analyst hours and a room full of data you cannot afford to read in full. ConsultBrain scores how you investigate — what you asked for, how your confidence moved, whether your numbers hold — then replays your trail beside an expert's.</p>
          <div className="grid g3 mt-24" style={{ maxWidth: 640 }}>
            {[['target', 'Hypothesis-led', 'Commit confidence before you see data, then update it.'], ['data', 'Evidence under budget', 'Every dataset and interview costs hours.'], ['replay', 'Evidence Trail Replay', 'See the moments you should have changed your mind.']].map(([i, t, d]) => <div key={t}><Icon name={i} size={18} className="acc" /><div className="mt-8" style={{ fontWeight: 600 }}>{t}</div><div className="small muted mt-4">{d}</div></div>)}
          </div>
        </div>
        <div className="row wrap gap-16">{RANKS.map((r) => <span key={r.id} className="row gap-6 xs muted"><RankEmblem rank={r.id} size={22} />{r.name}</span>)}</div>
      </section>
      <section className="landing-r">
        <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
          <h2>Enter the lab</h2>
          <p className="small muted mt-4 mb-16">No account or API key is needed for the demo.</p>
          <Seg value={mode} onChange={(m) => { setMode(m); setErr(null); }} options={[{ id: 'demo', label: 'Demo' }, { id: 'login', label: 'Sign in' }, { id: 'register', label: 'Create account' }]} />
          {mode === 'demo' && <div className="col mt-16" style={{ gap: 10 }}>
            <button className="panel pad hover" style={{ textAlign: 'left' }} disabled={!!busy} onClick={() => go('/auth/demo', { role: 'student' }, 's')}>
              <div className="row between"><span className="row gap-6"><RankEmblem rank="gold" size={26} /><b>Continue as demo learner</b></span><Icon name="arrow" className="acc" /></div>
              <div className="small muted mt-8">Aanya Kapoor · Gold · seeded history, with Brewly ready to investigate.</div></button>
            <button className="panel pad hover" style={{ textAlign: 'left' }} disabled={!!busy} onClick={() => go('/auth/demo', { role: 'professor' }, 'p')}>
              <div className="row between"><span className="row gap-6"><Icon name="class" size={20} className="acc" /><b>Continue as demo professor</b></span><Icon name="arrow" className="acc" /></div>
              <div className="small muted mt-8">A seeded class of 19 working on Brewly: trails, hypothesis distributions, grading.</div></button>
          </div>}
          {mode !== 'demo' && <form className="col mt-16" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); go(mode === 'login' ? '/auth/login' : '/auth/register', f, 'f'); }}>
            {mode === 'register' && <><Field label="Full name" error={err?.fields?.name}><input className="input" value={f.name} onChange={set('name')} autoComplete="name" /></Field>
              <Field label="University or organisation"><input className="input" value={f.university} onChange={set('university')} /></Field>
              <Field label="I am a"><Seg value={f.role} onChange={(role) => setF({ ...f, role })} options={[{ id: 'student', label: 'Learner' }, { id: 'professor', label: 'Professor' }]} /></Field></>}
            <Field label="Email" error={err?.fields?.email}><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
            <Field label="Password" error={err?.fields?.password} hint={mode === 'register' ? 'At least 8 characters. Stored hashed on this server.' : null}><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>
            <button className="btn primary lg" disabled={!!busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>}
          {err && !err.fields && <div className="callout neg mt-12">{err.message}</div>}
          <p className="xs muted mt-24">ConsultBrain cases are original fictional simulations. Certificates are ConsultBrain achievements, not academic credentials.</p>
        </div>
      </section>
    </div>
  );
}
