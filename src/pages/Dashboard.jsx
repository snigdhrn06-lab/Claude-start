import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ago, Bar, CountUp, DemoTag, ErrorState, Icon, PageSkeleton, Person, RankEmblem, rankMeta, scoreTone, Seg, SKILL_COLOR, useApi } from '../components/ui.jsx';
import { LineChart, MiniBars, Radar, Ring } from '../components/charts.jsx';

const SHORT = { structuring: 'Structure', hypothesis: 'Hypothesis', evidence: 'Evidence', quant: 'Quant', calibration: 'Calibration', synthesis: 'Synthesis' };
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Dashboard() {
  const { data: d, loading, error, reload } = useApi('/dashboard'); const nav = useNavigate(); const [trend, setTrend] = useState('iq');
  if (loading) return <PageSkeleton />; if (error) return <ErrorState error={error} retry={reload} />;
  const first = d.user.name.split(' ')[0]; const rm = rankMeta(d.rank.id); const weakest = [...d.skills].sort((a, b) => a.value - b.value)[0], strongest = [...d.skills].sort((a, b) => b.value - a.value)[0];
  const hist = d.skillHistory; const cats = hist.map((h) => new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  const series = trend === 'iq' ? [{ label: 'Consulting intelligence', values: hist.map((h) => h.iq), color: 'var(--accent)' }] : d.skills.map((s) => ({ label: s.label, values: hist.map((h) => Math.round(h.skills[s.id])), color: SKILL_COLOR[s.id] }));
  const rc = d.recommended.case;
  return (
    <div className="page">
      <div className="page-h">
        <div><div className="eyebrow mb-8">Command Centre</div><h1>{greeting()}, {first}.</h1>
          <p className="t2 mt-8">{d.casesCompleted === 0 && strongest.value === weakest.value ? 'Your six skills are unrated until you complete an investigation. Start with the recommended case.' : <>You are strongest at <b style={{ color: SKILL_COLOR[strongest.id] }}>{strongest.label.toLowerCase()}</b> and leaving the most on the table in <b style={{ color: SKILL_COLOR[weakest.id] }}>{weakest.label.toLowerCase()}</b>.</>}</p></div>
        <button className="btn primary lg" onClick={() => nav(`/vault?open=${rc.id}`)}><Icon name="play" size={14} />{d.recent.find((r) => r.status === 'active') ? 'Resume investigation' : 'Start recommended case'}</button>
      </div>

      <div className="grid g12 stagger">
        {/* Where am I */}
        <div className="panel pad s4">
          <div className="row between"><span className="eyebrow">Rank</span><Link to="/progress" className="xs acc">Ladder →</Link></div>
          <div className="row gap-16 mt-12"><RankEmblem rank={d.rank.id} size={64} />
            <div><div className="serif" style={{ fontSize: 28, lineHeight: 1, color: rm.color }}>{d.rank.name}</div><div className="mono mt-8" style={{ fontSize: 20 }}><CountUp value={d.user.xp} /> <span className="muted xs">XP</span></div></div></div>
          {d.rank.next ? <><div className="row between xs muted mt-16"><span>Progress to {d.rank.next.name}</span><span className="mono">{d.user.xp.toLocaleString('en-IN')} / {d.rank.next.xp.toLocaleString('en-IN')}</span></div><Bar value={d.rank.progress * 100} className="mt-4" color={rankMeta(d.rank.next.id).color} />
            <div className="col mt-12" style={{ gap: 5 }}>{d.rank.reqs.map((r) => <div key={r.label} className="row gap-6 xs" style={{ color: r.met ? 'var(--text-2)' : 'var(--muted)' }}><Icon name={r.met ? 'check' : 'minus'} size={12} className={r.met ? 'pos' : ''} /><span className="grow">{r.label}</span>{!r.met && <span className="mono">{r.current}/{r.target}</span>}</div>)}</div></> : <div className="small muted mt-16">Top rank reached.</div>}
        </div>

        {/* How good am I */}
        <div className="panel pad s4">
          <div className="row between"><span className="eyebrow">Consulting intelligence</span><span className="xs muted">six-skill weighted rating</span></div>
          <div className="row gap-16 mt-8" style={{ alignItems: 'center' }}>
            <Ring value={d.user.iq} size={104} stroke={8}><div><div className="mono" style={{ fontSize: 30, lineHeight: 1 }}><CountUp value={d.user.iq} /></div><div className="xs muted">of 100</div></div></Ring>
            <div className="col grow" style={{ gap: 7 }}>{d.skills.map((s) => <div key={s.id}><div className="row between xs"><span className="t2">{SHORT[s.id]}</span><span className="row gap-6"><span className={`mono ${s.delta > 0 ? 'pos' : s.delta < 0 ? 'neg' : 'muted'}`} style={{ fontSize: 10.5 }}>{s.delta > 0 ? '+' : ''}{s.delta || ''}</span><span className="mono">{s.value}</span></span></div><Bar value={s.value} className="thin mt-4" color={SKILL_COLOR[s.id]} /></div>)}</div>
          </div>
        </div>

        {/* How do I compare */}
        <div className="panel s4">
          <div className="panel-h"><span className="eyebrow">Global standing</span><Link to="/leaderboards" className="xs acc">All boards →</Link></div>
          <div className="panel-b" style={{ paddingTop: 10 }}>
            <div className="row gap-24"><div className="kpi"><span className="v">#{d.position.global}</span><span className="xs muted">of {d.position.of} learners</span></div><div className="kpi"><span className="v">#{d.position.weekly}</span><span className="xs muted">this week · {d.position.weeklyXp} XP</span></div>
              <div className="kpi"><span className="v row gap-6"><Icon name="flame" size={20} style={{ color: 'var(--warn)' }} />{d.user.streak}</span><span className="xs muted">day streak</span></div></div>
            <table className="table mt-12"><tbody>{d.position.around.map((r) => <tr key={r.userId} className={`clickable ${r.you ? 'you' : ''}`} onClick={() => nav(`/u/${r.userId}`)}><td className="n muted" style={{ width: 34, paddingLeft: 6 }}>{r.pos}</td><td style={{ padding: '6px 8px' }}><Person name={r.name} demo={r.demo && !r.you} rank={r.rank} size={22} /></td><td className="n" style={{ paddingRight: 6 }}>{r.value.toLocaleString('en-IN')}</td></tr>)}</tbody></table>
          </div>
        </div>

        {/* What have I improved */}
        <div className="panel s8">
          <div className="panel-h"><span className="eyebrow">Performance trend</span><Seg value={trend} onChange={setTrend} options={[{ id: 'iq', label: 'Overall' }, { id: 'skills', label: 'By skill' }]} /></div>
          <div className="panel-b">{hist.length >= 2 ? <LineChart categories={cats} series={series} height={210} yMax={100} area={trend === 'iq'} /> : <div className="empty"><Icon name="progress" size={22} /><div className="t">Your trend starts with your first completed case</div><div className="small">Each investigation re-rates all six skills.</div></div>}
            {trend === 'skills' && hist.length >= 2 && <div className="row wrap gap-16 xs t2 mt-8">{d.skills.map((s) => <span key={s.id} className="row gap-6"><span className="dot" style={{ background: SKILL_COLOR[s.id] }} />{s.label}</span>)}</div>}</div>
        </div>
        <div className="panel s4">
          <div className="panel-h"><span className="eyebrow">Skill profile</span><span className="xs muted">{d.casesCompleted} cases completed</span></div>
          <div className="panel-b"><Radar data={d.skills.map((s) => ({ ...s, short: SHORT[s.id] }))} size={250} /></div>
        </div>

        {/* What should I do next */}
        <div className="panel s5 hover" onClick={() => nav(`/vault?open=${rc.id}`)} style={{ borderColor: 'var(--accent)', background: 'linear-gradient(180deg, var(--accent-soft), transparent 70%), var(--surface)' }}>
          <div className="panel-b">
            <div className="row between"><span className="eyebrow acc">Recommended next</span><span className="chip acc">+{rc.xpReward} XP</span></div>
            <div className="xs muted mt-12">{rc.company} · {rc.industry}</div><h2 className="mt-4">{rc.title}</h2>
            <p className="small t2 mt-8">{rc.blurb}</p>
            <div className="callout mt-12 small"><Icon name="target" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{d.recommended.why}</div>
            <div className="row gap-16 xs muted mt-12"><span className="row gap-4"><Icon name="clock" size={13} />{rc.durationMin} min</span><span>{rc.difficultyLabel}</span><span>{rc.budgetHours} analyst hours</span></div>
          </div>
        </div>
        <div className="panel s4">
          <div className="panel-h"><span className="eyebrow">Daily Diagnostic</span>{d.daily.played ? <span className="chip pos"><Icon name="check" size={11} />Done today</span> : <span className="chip acc">Open</span>}</div>
          <div className="panel-b"><h3 style={{ fontSize: 15 }}>{d.daily.title}</h3><p className="small t2 mt-8" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.daily.scenario}</p>
            <div className="row between mt-12"><span className="xs muted">4 minutes · keeps your streak</span><button className="btn sm" onClick={() => nav('/daily')}>{d.daily.played ? 'Play again' : 'Diagnose'}<Icon name="arrow" size={13} /></button></div></div>
        </div>
        <div className="panel s3">
          <div className="panel-h"><span className="eyebrow">XP · 14 days</span></div>
          <div className="panel-b"><MiniBars values={d.xpDays.map((x) => x.xp)} labels={d.xpDays.map((x) => x.day)} height={64} />
            <div className="row between xs muted mt-8"><span>{d.xpDays[0].day.slice(5)}</span><span>today</span></div>
            <div className="mono mt-8" style={{ fontSize: 18 }}>{d.xpDays.reduce((s, x) => s + x.xp, 0).toLocaleString('en-IN')} <span className="xs muted">XP earned</span></div></div>
        </div>

        <div className="panel s4">
          <div className="panel-h"><span className="eyebrow">Weekly tournament</span><span className="xs muted">ends {new Date(d.tournament.endsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
          <div className="panel-b"><div className="xs muted">{d.tournament.company}</div><h3 style={{ fontSize: 15 }} className="mt-4">{d.tournament.title}</h3>
            <p className="small t2 mt-8">Best single score this week counts. {d.tournament.entrants} entrants; top ten earn +{d.tournament.bonusXp} XP.</p>
            <div className="col mt-12" style={{ gap: 6 }}>{d.tournament.top.slice(0, 3).map((r) => <div key={r.userId} className="row between small"><span className="row gap-6"><span className="mono muted" style={{ width: 16 }}>{r.pos}</span><span className="truncate">{r.name}</span>{r.demo && <DemoTag />}</span><span className="mono">{r.value}</span></div>)}</div>
            <button className="btn sm mt-12" onClick={() => nav('/arena')}>{d.tournament.entered ? `Your best: ${d.tournament.you.value}` : 'View tournament'}</button></div>
        </div>
        <div className="panel s4">
          <div className="panel-h"><span className="eyebrow">Recent investigations</span><Link to="/progress" className="xs acc">History →</Link></div>
          {d.recent.length ? <div>{d.recent.slice(0, 4).map((a) => <div key={a.id} className="row between" style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => nav(a.status === 'active' ? `/case/${a.id}` : a.status === 'completed' ? `/replay/${a.id}` : '/vault')}>
            <div style={{ minWidth: 0 }}><div className="truncate" style={{ fontWeight: 500 }}>{a.company}</div><div className="xs muted">{a.status === 'active' ? 'In progress' : a.status === 'abandoned' ? 'Abandoned' : ago(a.completedAt)}{a.seeded ? ' · seeded' : ''}</div></div>
            {a.status === 'completed' ? <span className="mono" style={{ fontSize: 18, color: scoreTone(a.overall) }}>{a.overall}</span> : a.status === 'active' ? <span className="chip acc">Resume</span> : <span className="chip">—</span>}</div>)}</div>
            : <div className="empty"><Icon name="vault" size={22} /><div className="t">No investigations yet</div><div className="small">Open the Case Vault to take your first client.</div></div>}
        </div>
        <div className="panel s4">
          <div className="panel-h"><span className="eyebrow">Recognition</span><Link to="/progress" className="xs acc">All →</Link></div>
          <div className="panel-b col" style={{ gap: 10 }}>{d.achievements.length ? d.achievements.map((a) => <div key={a.id} className="row gap-10"><span className="avatar" style={{ background: 'var(--accent-soft)', borderColor: 'transparent', color: 'var(--accent)' }}><Icon name="star" size={14} /></span><div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{a.name}</div><div className="xs muted truncate">{a.desc}</div></div></div>)
            : <div className="small muted">Achievements recognise how you investigate — disciplined updating, efficient evidence, a defence that holds.</div>}
            <hr className="rule" style={{ margin: '4px 0' }} />
            <div className="row between small"><span className="t2">{d.season.name}</span><span className="mono">{d.season.complete}/{d.season.quests.length}</span></div><Bar value={d.season.complete} max={d.season.quests.length} className="thin" /></div>
        </div>
      </div>
    </div>
  );
}
