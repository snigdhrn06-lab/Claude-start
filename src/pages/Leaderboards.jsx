import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { motion } from 'motion/react';
import { DemoTag, Empty, Icon, initials, Person, RankEmblem, rankMeta, Skeleton, Tabs, useApi } from '../components/ui.jsx';

const BOARDS = [['global', 'Global'], ['weekly', 'This week'], ['monthly', '30 days'], ['friends', 'Following'], ['university', 'Universities'], ['skill', 'By skill'], ['iq', 'Consulting intelligence']];
export default function Leaderboards() {
  const [board, setBoard] = useState('global'); const [skill, setSkill] = useState('structuring'); const nav = useNavigate(); const { user } = useAuth();
  const { data: d, loading } = useApi(`/leaderboards?board=${board}&skill=${skill}`);
  const Change = ({ v }) => (v > 0 ? <span className="pos mono xs">▲ {v}</span> : v < 0 ? <span className="neg mono xs">▼ {-v}</span> : <span className="muted mono xs">–</span>);
  return (
    <div className="page">
      <div className="page-h"><div><div className="eyebrow mb-8">Leaderboards</div><h1 className="display" style={{ fontSize: 'clamp(32px, 3.6vw, 48px)' }}>The <em>standings</em>.</h1><p className="t2 mt-8">Rankings are computed on the server from the XP ledger and skill ratings. Seeded demo learners are labelled; they populate the boards until real cohorts join.</p></div>
        {d?.you && <div className="panel pad row gap-16"><div className="kpi"><span className="eyebrow">Your position</span><span className="v">#{d.you.pos}<span className="muted xs"> of {d.total}</span></span></div><div className="kpi"><span className="eyebrow">{d.unit}</span><span className="v">{d.you.value.toLocaleString('en-IN')}</span></div></div>}</div>
      <Tabs value={board} onChange={setBoard} tabs={BOARDS.map(([id, label]) => ({ id, label }))} />
      {board === 'skill' && d?.skills && <div className="row wrap gap-6 mt-12">{d.skills.map((s) => <button key={s.id} className={`chip line btnlike ${skill === s.id ? 'on' : ''}`} style={{ height: 28 }} onClick={() => setSkill(s.id)}>{s.label}</button>)}</div>}
      {d && board !== 'university' && d.rows.length >= 3 && <div className="grid g3 mt-16" style={{ alignItems: 'end' }}>{[1, 0, 2].map((k, slot) => { const r = d.rows[k]; const h = [150, 120, 100][k]; const col = ['var(--c1)', '#B9C3CE', '#C98A57'][k]; return (
        <motion.div key={r.userId + board} className="panel spot" style={{ cursor: 'pointer', textAlign: 'center', padding: '18px 14px 0', overflow: 'hidden', borderColor: k === 0 ? 'var(--accent-line)' : undefined }} onClick={() => nav(`/u/${r.userId}`)} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + slot * 0.1, type: 'spring', stiffness: 200, damping: 20 }}>
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 17, borderColor: col, boxShadow: `0 0 0 4px color-mix(in srgb, ${col} 18%, transparent)` }}>{initials(r.name)}</span>
          <div className="row gap-6 mt-8" style={{ justifyContent: 'center' }}><b>{r.name}</b>{r.demo && !r.you && <DemoTag />}</div><div className="xs muted">{r.university}</div>
          <div className="mono mt-8" style={{ fontSize: 22, color: col }}>{r.value.toLocaleString('en-IN')}</div><div className="xs muted">{d.unit}</div>
          <motion.div initial={{ height: 0 }} animate={{ height: h * 0.45 }} transition={{ delay: 0.3 + slot * 0.1, duration: 0.7 }} style={{ marginTop: 12, marginLeft: -14, marginRight: -14, background: `linear-gradient(180deg, color-mix(in srgb, ${col} 22%, transparent), transparent)`, borderTop: `2px solid ${col}`, display: 'grid', placeItems: 'center' }}><span className="serif" style={{ fontSize: 30, color: col }}>{k + 1}</span></motion.div>
        </motion.div>); })}</div>}
      <div className="panel mt-16">{loading || !d ? <div style={{ padding: 16 }}><Skeleton h={360} /></div> : d.rows.length === 0 ? <Empty icon="team" title="Nobody here yet">Follow learners from their profiles to build this board.</Empty>
        : board === 'university' ? <div className="scroll-x"><table className="table"><thead><tr><th style={{ width: 50 }}>#</th><th>University</th><th className="n">Learners</th><th className="n">Avg. intelligence</th><th className="n">Total XP</th><th className="n">XP this week</th></tr></thead>
          <tbody>{d.rows.map((r) => <tr key={r.university} className={r.you ? 'you' : ''}><td className="n muted" style={{ textAlign: 'left' }}>{r.pos}</td><td style={{ fontWeight: 500 }}>{r.university}{r.you && <span className="chip acc" style={{ marginLeft: 8 }}>Yours</span>}</td><td className="n">{r.members}</td><td className="n">{r.iq}</td><td className="n">{r.xp.toLocaleString('en-IN')}</td><td className="n">{r.weekly.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
        : <div className="scroll-x"><table className="table"><thead><tr><th style={{ width: 50 }}>#</th><th style={{ width: 54 }}>Move</th><th>Learner</th><th className="hide-sm">University</th><th className="n hide-sm">Intelligence</th><th className="n hide-sm">Streak</th><th className="n">{d.unit}</th></tr></thead>
          <tbody>{d.rows.map((r, i) => <motion.tr key={r.userId} className={`clickable ${r.you ? 'you' : ''}`} onClick={() => nav(`/u/${r.userId}`)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.02 }}><td className="n" style={{ textAlign: 'left', color: r.pos <= 3 ? 'var(--accent)' : 'var(--muted)' }}>{r.pos}</td><td><Change v={r.change} /></td><td><Person name={r.you ? `${r.name} (you)` : r.name} demo={r.demo} rank={r.rank} size={26} /></td><td className="t2 hide-sm">{r.university}</td><td className="n hide-sm">{r.iq}</td><td className="n hide-sm"><span className="row gap-4" style={{ justifyContent: 'flex-end' }}><Icon name="flame" size={12} style={{ color: r.streak ? 'var(--warn)' : 'var(--faint)' }} />{r.streak}</span></td><td className="n" style={{ fontWeight: 500 }}>{r.value.toLocaleString('en-IN')}</td></motion.tr>)}</tbody></table></div>}</div>
      {user.role === 'student' && <p className="xs muted mt-12"><Icon name="info" size={12} style={{ verticalAlign: -2 }} /> Open any learner to compare skill profiles, follow them, or challenge them on a case you have completed.</p>}
    </div>
  );
}
