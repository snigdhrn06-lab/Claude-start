import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ago, Bar, CountUp, DemoTag, ErrorState, Icon, RankEmblem, rankMeta, RANKS, scoreTone, Seg, SKILL_COLOR, Skeleton, spotlight, Tip, useApi } from '../components/ui.jsx';
import { LineChart, MiniBars, Radar } from '../components/charts.jsx';
import { CaseArt, caseTheme, ModeArt, MODE_THEME } from '../components/Art.jsx';

const SHORT = { structuring: 'Structure', hypothesis: 'Hypothesis', evidence: 'Evidence', quant: 'Quant', calibration: 'Calibration', synthesis: 'Synthesis' };
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const rise = (i = 0) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.06 * i, ease: [0.22, 0.8, 0.24, 1] } });
const until = (t) => { const d = Math.max(0, t - Date.now()); const h = Math.floor(d / 3600000); return h >= 48 ? `${Math.round(h / 24)}d` : `${h}h ${Math.floor((d % 3600000) / 60000)}m`; };

function DashSkeleton() { return <div className="page"><Skeleton h={300} /><div className="grid g12 mt-16"><Skeleton h={220} className="s8" /><Skeleton h={220} className="s4" /></div><div className="grid g3 mt-16"><Skeleton h={180} /><Skeleton h={180} /><Skeleton h={180} /></div></div>; }

export default function Dashboard() {
  const { data: d, loading, error, reload } = useApi('/dashboard'); const nav = useNavigate(); const [trend, setTrend] = useState('iq');
  if (loading && !d) return <DashSkeleton />; if (error) return <ErrorState error={error} retry={reload} />;
  const first = d.user.name.split(' ')[0]; const rm = rankMeta(d.rank.id); const nextRm = d.rank.next ? rankMeta(d.rank.next.id) : null;
  const sorted = [...d.skills].sort((a, b) => a.value - b.value); const weakest = sorted[0], strongest = sorted.at(-1);
  const active = d.active[0]; const rc = d.recommended.case;
  const hist = d.skillHistory; const cats = hist.map((h) => new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  const series = trend === 'iq' ? [{ label: 'Consulting intelligence', values: hist.map((h) => h.iq), color: 'var(--accent)' }] : d.skills.map((s) => ({ label: s.label, values: hist.map((h) => Math.round(h.skills[s.id])), color: SKILL_COLOR[s.id] }));
  const unrated = d.casesCompleted === 0 && strongest.value === weakest.value;
  const primary = active ? { label: 'Continue investigation', to: `/case/${active.id}` } : { label: 'Start investigation', to: `/vault?open=${rc.id}` };
  return (
    <div className="page">
      {/* ------------------------------------------------ HERO */}
      <motion.section className="hero" style={{ '--rank': rm.color }} {...rise(0)}>
        <svg className="hero-grid" viewBox="0 0 1200 340" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 260 C 200 240, 320 280, 480 220 S 760 160, 900 190 S 1100 120, 1200 140" fill="none" stroke={rm.color} strokeOpacity="0.35" strokeWidth="1.5" />
          <path d="M0 260 C 200 240, 320 280, 480 220 S 760 160, 900 190 S 1100 120, 1200 140" fill="none" stroke="#fff" strokeOpacity="0.25" className="data-line" />
          <path d="M0 300 C 240 290, 420 300, 600 270 S 900 250, 1200 230" fill="none" stroke="var(--signal)" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 6" />
        </svg>
        <div className="grid g12" style={{ position: 'relative', padding: '30px 32px', gap: 28, alignItems: 'center' }}>
          <div className="s7">
            <div className="row wrap gap-10"><span className="eyebrow acc">Command Centre</span><span className="chip line"><span className="live-dot" style={{ width: 6, height: 6 }} />{d.season.name} · ends in {until(d.season.endsAt)}</span></div>
            <h1 className="display mt-16">{greeting()}, <em>{first}</em>.</h1>
            <p className="t2 mt-12" style={{ fontSize: 15.5, maxWidth: 560, lineHeight: 1.6 }}>{unrated ? 'Your six skills are unrated until your first investigation. Take a client, commit to hypotheses, and see how your reasoning holds up.'
              : <>You are strongest at <b style={{ color: SKILL_COLOR[strongest.id] }}>{strongest.label.toLowerCase()}</b> and leaving the most on the table in <b style={{ color: SKILL_COLOR[weakest.id] }}>{weakest.label.toLowerCase()}</b>. {active ? `${active.company} is waiting at the ${active.stage.toLowerCase()} stage.` : d.recommended.why}</>}</p>
            <div className="row wrap gap-10 mt-24">
              <button className="btn primary xl hero-cta" onClick={() => nav(primary.to)}><Icon name="play" size={14} />{primary.label}</button>
              <button className="btn lg" onClick={() => nav('/daily')}><Icon name="daily" size={15} />{d.daily.played ? 'Daily done' : 'Daily Diagnostic'}{!d.daily.played && <span className="chip acc" style={{ marginLeft: 2 }}>today</span>}</button>
            </div>
          </div>
          <div className="s5">
            <div className="row gap-20" style={{ justifyContent: 'flex-end' }}>
              <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 14, delay: 0.15 }}><RankEmblem rank={d.rank.id} size={118} glow /></motion.div>
              <div style={{ minWidth: 0, flex: 1, maxWidth: 280 }}>
                <div className="eyebrow">Competitive rank</div>
                <div className="serif" style={{ fontSize: 40, lineHeight: 1, color: rm.color, marginTop: 6 }}>{d.rank.name}</div>
                <div className="mono mt-8" style={{ fontSize: 22 }}><CountUp value={d.user.xp} duration={1200} /> <span className="xs muted">XP</span></div>
                {d.rank.next ? <><div className="row between xs muted mt-12"><span>Next: <b style={{ color: nextRm.color }}>{d.rank.next.name}</b></span><span className="mono">{(d.rank.next.xp - d.user.xp).toLocaleString('en-IN')} XP to go</span></div>
                  <div className="bar thick shimmer mt-4"><motion.i initial={{ width: 0 }} animate={{ width: `${d.rank.progress * 100}%` }} transition={{ duration: 1.3, delay: 0.3, ease: [0.22, 0.8, 0.24, 1] }} style={{ background: `linear-gradient(90deg, ${rm.color}, var(--accent-2))`, boxShadow: `0 0 12px ${rm.color}` }} /></div>
                  <div className="row wrap gap-6 mt-8">{d.rank.reqs.map((q) => <Tip key={q.label} label={q.met ? 'Requirement met' : `${q.current.toLocaleString('en-IN')} of ${q.target.toLocaleString('en-IN')}`}><span className={`chip ${q.met ? 'pos' : 'line'}`}><Icon name={q.met ? 'check' : 'minus'} size={10} />{q.label}</span></Tip>)}</div></> : <div className="small muted mt-12">Top rank reached.</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="row wrap" style={{ position: 'relative', borderTop: '1px solid var(--line)', padding: '12px 32px', gap: 28 }}>
          {[['Global', `#${d.position.global}`, `of ${d.position.of}`], ['This week', `#${d.position.weekly}`, `${d.position.weeklyXp.toLocaleString('en-IN')} XP`], ['Streak', `${d.user.streak}`, 'days', 'flame'], ['Intelligence', d.user.iq, 'of 100'], ['Cases', d.casesCompleted, 'completed']].map(([k, v, s, ic], i) => <motion.div key={k} className="row gap-10" {...rise(i + 2)}><span className="eyebrow">{k}</span><span className="mono row gap-4" style={{ fontSize: 17 }}>{ic && <Icon name={ic} size={15} style={{ color: 'var(--warn)' }} />}{v}</span><span className="xs muted">{s}</span></motion.div>)}
        </div>
      </motion.section>

      {/* ------------------------------------------------ ACTIVE + DAILY */}
      <div className="grid g12 mt-16">
        <motion.div className="s8" {...rise(2)}>
          {active ? d.active.slice(0, 2).map((a) => { const th = caseTheme(a.caseId); const left = a.budget - a.hoursUsed; return (
            <div key={a.id} className="case-card spot" onMouseMove={spotlight} style={{ '--case': th.color, display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', marginBottom: 12 }} onClick={() => nav(`/case/${a.id}`)}>
              <div className="case-art" style={{ height: 'auto', minHeight: 200, borderBottom: 0, borderRight: '1px solid var(--line)' }}><CaseArt id={a.caseId} initials={a.company.split(' ').map((w) => w[0]).join('').slice(0, 2)} /><span className="status-ribbon chip acc"><span className="live-dot" style={{ width: 6, height: 6, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />Active investigation</span></div>
              <div className="case-body">
                <div className="row between"><span className="xs muted">{a.company} · {a.industry}</span><span className="chip line">{a.difficultyLabel}</span></div>
                <h2>{a.title}</h2>
                <div className="grid g3" style={{ gap: 10 }}>{[['Stage', a.stage], ['Hypotheses', a.hypotheses], ['Evidence', a.evidence]].map(([k, v]) => <div key={k}><div className="eyebrow">{k}</div><div className="mt-4" style={{ fontWeight: 500 }}>{v}</div></div>)}</div>
                <div><div className="row between xs"><span className="muted">Analyst hours</span><span className="mono"><b style={{ color: left <= 6 ? 'var(--neg)' : 'var(--text)' }}>{left}</b> / {a.budget} left</span></div><div className="meter-seg mt-4">{Array.from({ length: a.budget / 2 }, (_, i) => <i key={i} className={i < a.hoursUsed / 2 ? 'on' : ''} />)}</div></div>
                <div className="row between mt-4"><span className="mono small acc">up to +{a.xpReward} XP</span><button className="btn primary"><Icon name="play" size={13} />Continue investigation</button></div>
              </div></div>); })
            : <div className="case-card spot" onMouseMove={spotlight} style={{ '--case': caseTheme(rc.id).color, display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' }} onClick={() => nav(`/vault?open=${rc.id}`)}>
              <div className="case-art" style={{ height: 'auto', minHeight: 220, borderBottom: 0, borderRight: '1px solid var(--line)' }}><CaseArt id={rc.id} initials={rc.company.split(' ').map((w) => w[0]).join('').slice(0, 2)} /><span className="status-ribbon chip acc">Recommended next</span></div>
              <div className="case-body"><div className="row between"><span className="xs muted">{rc.company} · {rc.industry}</span><span className="mono small acc">+{rc.xpReward} XP</span></div><h2>{rc.title}</h2><p className="small t2">{rc.blurb}</p>
                <div className="callout small"><Icon name="target" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{d.recommended.why}</div>
                <div className="row between"><span className="row gap-16 xs muted nowrap"><span className="row gap-4"><Icon name="clock" size={13} />{rc.durationMin} min</span><span>{rc.difficultyLabel}</span><span>{rc.budgetHours} analyst hours</span></span><button className="btn primary">Start investigation<Icon name="arrow" size={13} /></button></div></div></div>}
        </motion.div>
        <motion.div className="s4" {...rise(3)}>
          <div className="mode-banner" style={{ '--mode': MODE_THEME.daily.color, height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => nav('/daily')}>
            <div className="mode-art" style={{ width: '100%', height: 70, top: 'auto', bottom: 58, opacity: 0.5 }}><ModeArt id="daily" /></div>
            <div className="row between" style={{ position: 'relative' }}><span className="eyebrow acc row gap-6"><Icon name="daily" size={12} />Daily Diagnostic</span>{d.daily.played ? <span className="chip pos"><Icon name="check" size={11} />Solved today</span> : <span className="chip acc">resets in {until(d.missions.resetsAt.daily)}</span>}</div>
            <h2 className="mt-12" style={{ position: 'relative' }}>{d.daily.title}</h2>
            <p className="small t2 mt-8" style={{ position: 'relative', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.daily.scenario}</p>
            <div style={{ flex: 1, minHeight: 70 }} />
            <div className="row between" style={{ position: 'relative' }}><span className="xs muted">4 min · keeps your <b className="acc">{d.user.streak}-day</b> streak</span><button className="btn primary sm">{d.daily.played ? 'Play again' : 'Diagnose'}<Icon name="arrow" size={13} /></button></div>
          </div>
        </motion.div>
      </div>

      {/* ------------------------------------------------ PROGRESSION */}
      <div className="grid g12 mt-16">
        <motion.div className="panel s5" {...rise(3)}>
          <div className="panel-h"><span className="eyebrow">Rank ladder</span><Link to="/progress" className="xs acc">Requirements →</Link></div>
          <div className="panel-b">
            <div className="row" style={{ justifyContent: 'space-between', position: 'relative', padding: '6px 4px 0' }}>
              <div style={{ position: 'absolute', left: 22, right: 22, top: 26, height: 2, background: 'var(--surface-3)', borderRadius: 2 }}><motion.div initial={{ width: 0 }} animate={{ width: `${((d.rank.index + d.rank.progress) / (RANKS.length - 1)) * 100}%` }} transition={{ duration: 1.4, delay: 0.4 }} style={{ height: '100%', background: `linear-gradient(90deg, ${RANKS[0].color}, ${rm.color})`, borderRadius: 2, boxShadow: `0 0 10px ${rm.color}` }} /></div>
              {RANKS.map((r, i) => <Tip key={r.id} label={i <= d.rank.index ? `${r.name} — earned` : `${r.name} — locked`}><div className="col" style={{ alignItems: 'center', gap: 6, position: 'relative' }}><motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: i === d.rank.index ? 1.12 : 1, opacity: 1 }} transition={{ delay: 0.25 + i * 0.07, type: 'spring', stiffness: 260, damping: 16 }}><RankEmblem rank={r.id} size={i === d.rank.index ? 44 : 38} muted={i > d.rank.index} glow={i === d.rank.index} /></motion.div><span className="xs" style={{ color: i <= d.rank.index ? r.color : 'var(--faint)', fontWeight: i === d.rank.index ? 600 : 400 }}>{r.name}</span></div></Tip>)}
            </div>
            <hr className="rule" style={{ margin: '16px 0 12px' }} />
            <div className="eyebrow mb-8">Recent achievements</div>
            {d.achievements.length ? <div className="col" style={{ gap: 8 }}>{d.achievements.slice(0, 3).map((a, i) => <motion.div key={a.id} className="row gap-10" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }}><span className="avatar" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent)' }}><Icon name="star" size={13} /></span><div style={{ minWidth: 0 }} className="grow"><div style={{ fontWeight: 500 }}>{a.name}</div><div className="xs muted truncate">{a.desc}</div></div><span className="xs muted">{ago(a.t)}</span></motion.div>)}</div>
              : <p className="small muted">Achievements recognise how you investigate: disciplined updating, efficient evidence, a defence that holds.</p>}
          </div>
        </motion.div>
        <motion.div className="panel s4" {...rise(4)}>
          <div className="panel-h"><span className="eyebrow">Skill profile</span><span className="xs muted">six dimensions</span></div>
          <div className="panel-b"><Radar data={d.skills.map((s) => ({ ...s, short: SHORT[s.id] }))} size={236} /></div>
        </motion.div>
        <motion.div className="panel s3" {...rise(5)}>
          <div className="panel-h"><span className="eyebrow">Skill movement</span></div>
          <div className="panel-b col" style={{ gap: 9 }}>{d.skills.map((s, i) => <div key={s.id}><div className="row between xs"><span className="t2">{SHORT[s.id]}</span><span className="row gap-6">{s.delta !== 0 && <span className={`mono ${s.delta > 0 ? 'pos' : 'neg'}`} style={{ fontSize: 10.5 }}>{s.delta > 0 ? '▲' : '▼'}{Math.abs(s.delta)}</span>}<span className="mono">{s.value}</span></span></div>
            <div className="bar thin mt-4"><motion.i initial={{ width: 0 }} animate={{ width: `${s.value}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.06 }} style={{ background: SKILL_COLOR[s.id], boxShadow: `0 0 8px ${SKILL_COLOR[s.id]}` }} /></div></div>)}
            <p className="xs muted mt-4">Change since your first rated investigation.</p></div>
        </motion.div>
      </div>

      {/* ------------------------------------------------ COMPETITION + MISSIONS */}
      <div className="grid g12 mt-16">
        <div className="s7 col" style={{ gap: 14 }}><motion.div className="panel" {...rise(4)}>
          <div className="panel-h"><span className="row gap-10"><span className="eyebrow">Competitive intelligence</span><span className="chip line">Global XP</span></span><Link to="/leaderboards" className="xs acc">All boards →</Link></div>
          <table className="table"><thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 52 }}>Move</th><th>Learner</th><th className="n hide-sm">Streak</th><th className="n hide-sm">This week</th><th className="n">XP</th></tr></thead>
            <tbody>{d.position.around.map((r, i) => <motion.tr key={r.userId} className={`clickable ${r.you ? 'you' : ''}`} onClick={() => nav(`/u/${r.userId}`)} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}>
              <td className="n" style={{ textAlign: 'left', color: r.you ? 'var(--accent)' : 'var(--muted)' }}>{r.pos}</td>
              <td>{r.change > 0 ? <span className="pos mono xs">▲ {r.change}</span> : r.change < 0 ? <span className="neg mono xs">▼ {-r.change}</span> : <span className="muted mono xs">–</span>}</td>
              <td><span className="row gap-10"><span className="avatar" style={{ borderColor: r.you ? 'var(--accent)' : undefined }}>{r.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span><span style={{ fontWeight: 500 }}>{r.you ? `${r.name} (you)` : r.name}</span>{r.demo && !r.you && <DemoTag />}<RankEmblem rank={r.rank} size={16} /></span></td>
              <td className="n hide-sm"><span className="row gap-4" style={{ justifyContent: 'flex-end' }}><Icon name="flame" size={12} style={{ color: r.streak ? 'var(--warn)' : 'var(--faint)' }} />{r.streak}</span></td>
              <td className="n hide-sm t2">{r.weekly.toLocaleString('en-IN')}</td><td className="n" style={{ fontWeight: 500 }}>{r.value.toLocaleString('en-IN')}</td></motion.tr>)}</tbody></table>
          {(() => { const you = d.position.around.find((r) => r.you); const above = d.position.around.find((r) => r.pos === (you?.pos || 0) - 1); return above && you ? <div className="panel-b small t2" style={{ borderTop: '1px solid var(--line)' }}><Icon name="up" size={13} className="acc" style={{ verticalAlign: -2, marginRight: 6 }} /><b className="mono acc">{(above.value - you.value + 1).toLocaleString('en-IN')} XP</b> overtakes {above.name} for #{above.pos}.</div> : null; })()}
        </motion.div>
        <motion.div className="panel" {...rise(5)}><div className="panel-h"><span className="row gap-10"><span className="eyebrow">Weekly tournament</span><span className="chip neg">Gold+</span></span><span className="xs muted">{d.tournament.company} · ends in {until(d.tournament.endsAt)}</span></div>
          <div className="panel-b row wrap gap-24" style={{ alignItems: 'center' }}>{d.tournament.top.slice(0, 3).map((r, i) => <div key={r.userId} className="row gap-10"><span className="serif" style={{ fontSize: 26, color: ['var(--c1)', '#B9C3CE', '#C98A57'][i] }}>{r.pos}</span><span><span className="row gap-6 small"><b>{r.name}</b>{r.demo && <DemoTag />}</span><span className="mono xs muted">{r.value} pts</span></span></div>)}
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => nav(d.tournament.entered ? '/arena' : `/vault?open=${d.tournament.caseId}`)}>{d.tournament.entered ? `Your best: ${d.tournament.you.value}` : `Enter · ${d.tournament.entrants} entrants`}<Icon name="arrow" size={12} /></button></div></motion.div></div>
        <motion.div className="panel s5" {...rise(5)}>
          <div className="panel-h"><span className="eyebrow">Missions</span><span className="xs muted">daily resets in {until(d.missions.resetsAt.daily)}</span></div>
          <div className="panel-b col" style={{ gap: 14 }}>
            {[['Daily', d.missions.daily], ['Weekly', d.missions.weekly]].map(([label, list]) => <div key={label}><div className="row between mb-8"><span className="eyebrow acc">{label}</span><span className="mono xs muted">{list.filter((m) => m.done).length}/{list.length}</span></div>
              <div className="col" style={{ gap: 8 }}>{list.map((m) => <button key={m.id} className="ds" style={{ padding: '9px 11px' }} onClick={() => nav(m.to)}>
                <span className="row gap-10" style={{ minWidth: 0 }}><span className="avatar" style={{ width: 22, height: 22, background: m.done ? 'var(--pos-soft)' : 'transparent', borderColor: m.done ? 'transparent' : 'var(--line-2)', color: m.done ? 'var(--pos)' : 'var(--faint)' }}><Icon name={m.done ? 'check' : 'minus'} size={11} /></span><span className="small truncate" style={{ color: m.done ? 'var(--text-2)' : 'var(--text)', textDecoration: m.done ? 'line-through' : 'none', textDecorationColor: 'var(--faint)' }}>{m.label}</span></span>
                <span className="mono xs muted">{m.cur}/{m.target}</span></button>)}</div></div>)}
            <p className="xs muted">{d.missions.note}</p>
          </div>
        </motion.div>
      </div>

      {/* ------------------------------------------------ DISCOVERY */}
      <motion.div className="row between mt-32 mb-12" {...rise(5)}><div><div className="eyebrow acc">Discover</div><h2 className="mt-4">Arena drills and open engagements</h2></div><Link to="/arena" className="btn sm">Open the Arena<Icon name="arrow" size={13} /></Link></motion.div>
      <div className="grid g4">
        {['margin', 'issue-tree', 'duel', 'market'].map((m, i) => <motion.div key={m} className="mode-card" style={{ '--mode': MODE_THEME[m].color }} onClick={() => nav(`/arena/${m}`)} {...rise(i + 5)} whileHover={{ y: -4 }}>
          <div className="mode-top"><ModeArt id={m} /></div>
          <div className="panel-b"><div className="eyebrow" style={{ color: MODE_THEME[m].color }}>{MODE_THEME[m].label}</div><div className="serif mt-4" style={{ fontSize: 18 }}>{{ margin: 'Margin Detective', 'issue-tree': 'Issue Tree Arena', duel: 'Hypothesis Duel', market: 'Market Strategy' }[m]}</div></div></motion.div>)}
      </div>
      <div className="grid g12 mt-16">
        <motion.div className="panel s8" {...rise(6)}>
          <div className="panel-h"><span className="eyebrow">Performance trend</span><Seg value={trend} onChange={setTrend} options={[{ id: 'iq', label: 'Overall' }, { id: 'skills', label: 'By skill' }]} /></div>
          <div className="panel-b">{hist.length >= 2 ? <LineChart categories={cats} series={series} height={210} yMax={100} area={trend === 'iq'} /> : <div className="empty"><span className="empty-ico"><Icon name="progress" size={20} /></span><div className="t">Your trend starts with your first completed case</div><div className="small">Each investigation re-rates all six skills.</div></div>}
            {trend === 'skills' && hist.length >= 2 && <div className="row wrap gap-16 xs t2 mt-8">{d.skills.map((s) => <span key={s.id} className="row gap-6"><span className="dot" style={{ background: SKILL_COLOR[s.id] }} />{s.label}</span>)}</div>}</div>
        </motion.div>
        <motion.div className="s4 col" style={{ gap: 14 }} {...rise(7)}>
          <div className="panel" style={{ flex: 1 }}><div className="panel-h"><span className="eyebrow">XP · 14 days</span><span className="mono small acc">{d.xpDays.reduce((s, x) => s + x.xp, 0).toLocaleString('en-IN')}</span></div><div className="panel-b"><MiniBars values={d.xpDays.map((x) => x.xp)} labels={d.xpDays.map((x) => x.day)} height={150} /><div className="row between xs muted mt-8"><span>{d.xpDays[0].day.slice(5)}</span><span>today</span></div>
            <div className="col mt-12" style={{ gap: 6 }}>{d.ledger.slice(0, 3).map((l, i) => <div key={i} className="row between xs"><span className="t2 truncate" style={{ maxWidth: 200 }}>{l.label}</span><span className="mono acc">+{l.amount}</span></div>)}</div></div></div>
        </motion.div>
      </div>
      {d.recent.filter((r) => r.status === 'completed').length > 0 && <motion.div className="panel mt-16" {...rise(8)}><div className="panel-h"><span className="eyebrow">Recent investigations</span><Link to="/progress" className="xs acc">History →</Link></div>
        <div className="grid g3" style={{ padding: 14, gap: 10 }}>{d.recent.filter((r) => r.status === 'completed').slice(0, 3).map((a) => <button key={a.id} className="ds" onClick={() => nav(`/replay/${a.id}`)}><span style={{ minWidth: 0 }}><span style={{ fontWeight: 500, display: 'block' }} className="truncate">{a.company}</span><span className="xs muted">{ago(a.completedAt)}{a.seeded ? ' · seeded' : ''} · replay</span></span><span className="mono" style={{ fontSize: 20, color: scoreTone(a.overall) }}>{a.overall}</span></button>)}</div></motion.div>}
    </div>
  );
}
