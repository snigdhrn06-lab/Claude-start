import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { DemoTag, Empty, Icon, Person, Skeleton, Tabs, useApi } from '../components/ui.jsx';

const BOARDS = [['global', 'Global'], ['weekly', 'This week'], ['monthly', '30 days'], ['friends', 'Following'], ['university', 'Universities'], ['skill', 'By skill'], ['iq', 'Consulting intelligence']];
export default function Leaderboards() {
  const [board, setBoard] = useState('global'); const [skill, setSkill] = useState('structuring'); const nav = useNavigate(); const { user } = useAuth();
  const { data: d, loading } = useApi(`/leaderboards?board=${board}&skill=${skill}`);
  const Change = ({ v }) => (v > 0 ? <span className="pos mono xs">▲ {v}</span> : v < 0 ? <span className="neg mono xs">▼ {-v}</span> : <span className="muted mono xs">–</span>);
  return (
    <div className="page">
      <div className="page-h"><div><div className="eyebrow mb-8">Leaderboards</div><h1>Standings</h1><p className="t2 mt-8">Rankings are computed on the server from the XP ledger and skill ratings. Seeded demo learners are labelled; they populate the boards until real cohorts join.</p></div>
        {d?.you && <div className="panel pad row gap-16"><div className="kpi"><span className="eyebrow">Your position</span><span className="v">#{d.you.pos}<span className="muted xs"> of {d.total}</span></span></div><div className="kpi"><span className="eyebrow">{d.unit}</span><span className="v">{d.you.value.toLocaleString('en-IN')}</span></div></div>}</div>
      <Tabs value={board} onChange={setBoard} tabs={BOARDS.map(([id, label]) => ({ id, label }))} />
      {board === 'skill' && d?.skills && <div className="row wrap gap-6 mt-12">{d.skills.map((s) => <button key={s.id} className={`chip line btnlike ${skill === s.id ? 'on' : ''}`} style={{ height: 28 }} onClick={() => setSkill(s.id)}>{s.label}</button>)}</div>}
      <div className="panel mt-16">{loading || !d ? <div style={{ padding: 16 }}><Skeleton h={360} /></div> : d.rows.length === 0 ? <Empty icon="team" title="Nobody here yet">Follow learners from their profiles to build this board.</Empty>
        : board === 'university' ? <div className="scroll-x"><table className="table"><thead><tr><th style={{ width: 50 }}>#</th><th>University</th><th className="n">Learners</th><th className="n">Avg. intelligence</th><th className="n">Total XP</th><th className="n">XP this week</th></tr></thead>
          <tbody>{d.rows.map((r) => <tr key={r.university} className={r.you ? 'you' : ''}><td className="n muted" style={{ textAlign: 'left' }}>{r.pos}</td><td style={{ fontWeight: 500 }}>{r.university}{r.you && <span className="chip acc" style={{ marginLeft: 8 }}>Yours</span>}</td><td className="n">{r.members}</td><td className="n">{r.iq}</td><td className="n">{r.xp.toLocaleString('en-IN')}</td><td className="n">{r.weekly.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
        : <div className="scroll-x"><table className="table"><thead><tr><th style={{ width: 50 }}>#</th><th style={{ width: 54 }}>Move</th><th>Learner</th><th className="hide-sm">University</th><th className="n hide-sm">Intelligence</th><th className="n">{d.unit}</th></tr></thead>
          <tbody>{d.rows.map((r) => <tr key={r.userId} className={`clickable ${r.you ? 'you' : ''}`} onClick={() => nav(`/u/${r.userId}`)}><td className="n" style={{ textAlign: 'left', color: r.pos <= 3 ? 'var(--accent)' : 'var(--muted)' }}>{r.pos}</td><td><Change v={r.change} /></td><td><Person name={r.you ? `${r.name} (you)` : r.name} demo={r.demo} rank={r.rank} size={26} /></td><td className="t2 hide-sm">{r.university}</td><td className="n hide-sm">{r.iq}</td><td className="n" style={{ fontWeight: 500 }}>{r.value.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>}</div>
      {user.role === 'student' && <p className="xs muted mt-12"><Icon name="info" size={12} style={{ verticalAlign: -2 }} /> Open any learner to compare skill profiles, follow them, or challenge them on a case you have completed.</p>}
    </div>
  );
}
