import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { post } from '../api.js';
import { DemoTag, ErrorState, fmtDate, Icon, initials, Modal, PageSkeleton, RankEmblem, rankMeta, scoreTone, useApi, useToast } from '../components/ui.jsx';
import { Radar } from '../components/charts.jsx';

export default function Profile() {
  const { id } = useParams(); const { data, loading, error, reload } = useApi(`/users/${id}`); const toast = useToast(); const nav = useNavigate();
  const [challenge, setChallenge] = useState(false); const { data: ch } = useApi(challenge ? '/challenges' : null); const [caseId, setCaseId] = useState(''); const [note, setNote] = useState('');
  if (loading) return <PageSkeleton />; if (error) return <ErrorState error={error} retry={reload} />;
  const p = data.profile; const rm = rankMeta(p.rank);
  const mine = ch ? ch.cases.filter((c) => ch.myBest[c.id] != null) : [];
  return (
    <div className="page">
      <div className="panel pad mb-16"><div className="row between wrap gap-16"><div className="row gap-16"><span className="avatar" style={{ width: 64, height: 64, fontSize: 22, borderColor: rm.color }}>{initials(p.name)}</span>
        <div><div className="row gap-10"><h1 style={{ fontSize: 26 }}>{p.name}</h1>{p.demo && <DemoTag />}</div><div className="t2 mt-4">{p.university}</div><div className="row gap-10 mt-8"><RankEmblem rank={p.rank} size={22} /><span style={{ color: rm.color, fontWeight: 600 }}>{rm.name}</span><span className="muted small">· #{p.position} globally · joined {fmtDate(p.joined)}</span></div></div></div>
        <div className="row gap-24"><div className="kpi"><span className="eyebrow">XP</span><span className="v">{p.xp.toLocaleString('en-IN')}</span></div><div className="kpi"><span className="eyebrow">Intelligence</span><span className="v">{p.iq}</span></div><div className="kpi"><span className="eyebrow">Cases</span><span className="v">{p.cases}</span></div><div className="kpi"><span className="eyebrow">Best streak</span><span className="v">{p.bestStreak}</span></div></div>
        {!p.isYou && <div className="row"><button className="btn" onClick={() => post(`/users/${id}/follow`).then((d) => { toast(d.following ? `Following ${p.name}` : 'Unfollowed', 'good'); reload(); }).catch((e) => toast(e.message, 'bad'))}><Icon name={p.following ? 'check' : 'plus'} size={13} />{p.following ? 'Following' : 'Follow'}</button><button className="btn primary" onClick={() => setChallenge(true)}><Icon name="swords" size={13} />Challenge</button></div>}</div>
        {p.demo && <p className="xs muted mt-12">This is a seeded demo learner used to populate leaderboards. Their statistics are sample data.</p>}</div>
      <div className="grid g12">
        <div className="panel s5"><div className="panel-h"><span className="eyebrow">{p.isYou ? 'Skill profile' : 'Skill profile vs yours'}</span>{!p.isYou && <span className="row gap-16 xs t2"><span className="row gap-6"><span className="dot" style={{ background: 'var(--accent)' }} />{p.name.split(' ')[0]}</span><span className="row gap-6"><span className="dot" style={{ background: 'var(--c4)' }} />You</span></span>}</div>
          <div className="panel-b"><Radar data={p.skills} compare={p.isYou ? null : data.compare.map((c) => ({ value: c.you }))} size={290} /></div></div>
        <div className="s7 col" style={{ gap: 14 }}>
          {!p.isYou && <div className="panel"><div className="panel-h"><span className="eyebrow">Head to head</span></div><table className="table"><thead><tr><th>Skill</th><th className="n">{p.name.split(' ')[0]}</th><th className="n">You</th><th className="n">Gap</th></tr></thead><tbody>{data.compare.map((c) => <tr key={c.id}><td>{c.label}</td><td className="n">{c.them}</td><td className="n">{c.you}</td><td className={`n ${c.you >= c.them ? 'pos' : 'neg'}`}>{c.you - c.them > 0 ? '+' : ''}{c.you - c.them}</td></tr>)}</tbody></table></div>}
          <div className="panel"><div className="panel-h"><span className="eyebrow">Achievements</span><span className="mono xs muted">{p.achievements.length}</span></div><div className="panel-b">{p.achievements.length ? <div className="row wrap gap-6">{p.achievements.map((a) => <span key={a.id} className="chip acc" title={a.desc} style={{ height: 26 }}><Icon name="star" size={11} />{a.name}</span>)}</div> : <div className="small muted">{p.demo ? 'Seeded learners carry ratings and XP only.' : 'No achievements yet.'}</div>}</div></div>
          <div className="panel"><div className="panel-h"><span className="eyebrow">Best case scores</span></div>{p.best.length ? <table className="table"><tbody>{p.best.map((b) => <tr key={b.caseId}><td><b>{b.company}</b> <span className="muted">· {b.title}</span></td><td className="n" style={{ color: scoreTone(b.score), fontSize: 15 }}>{b.score}</td></tr>)}</tbody></table> : <div className="panel-b small muted">{p.demo ? 'Seeded learners have no recorded case attempts.' : 'No completed cases yet.'}</div>}</div>
          {p.certificates.length > 0 && <div className="panel"><div className="panel-h"><span className="eyebrow">Certificates</span></div><div className="panel-b row wrap gap-10">{p.certificates.map((c) => <button key={c.id} className="chip line btnlike" style={{ height: 28 }} onClick={() => nav(`/verify/${c.id}`)}><RankEmblem rank={c.rank} size={15} /><span className="mono">{c.id}</span></button>)}</div></div>}
        </div>
      </div>
      {challenge && <Modal onClose={() => setChallenge(false)}><div style={{ padding: 22 }}><h2>Challenge {p.name}</h2><p className="t2 mt-8">Your best score on the case becomes the bar they have to beat.{p.demo && ' Seeded demo learners cannot respond, so this challenge will stay open.'}</p>
        {!ch ? <div className="skel mt-16" style={{ height: 60 }} /> : mine.length === 0 ? <div className="callout mt-16">Complete a case first. You can only challenge on cases you have finished.</div> : <><div className="field mt-16"><label>Case</label><select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Choose a case…</option>{mine.map((c) => <option key={c.id} value={c.id}>{c.title} — your best {ch.myBest[c.id]}</option>)}</select></div><div className="field mt-12"><label>Message (optional)</label><input className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} /></div></>}
        <div className="row end mt-16"><button className="btn" onClick={() => setChallenge(false)}>Cancel</button><button className="btn primary" disabled={!caseId} onClick={() => post('/challenges', { toUserId: id, caseId, note }).then(() => { toast('Challenge sent', 'good'); setChallenge(false); }).catch((e) => toast(e.message, 'bad'))}>Send challenge</button></div></div></Modal>}
    </div>
  );
}
