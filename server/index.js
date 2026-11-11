// Consult Brain API server. All scoring, XP and progression logic runs here; the client is a view.
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { all, col, put, uid, save } from './store.js';
import { seed } from './seed.js';
import { CASES, getCase } from './cases/index.js';
import { newAttempt, act, view, finalize, caseCard, caseBrief, ActionError } from './engine/caseEngine.js';
import { SKILLS } from './engine/scoring.js';
import { newUser, rankStatus, RANKS, ACHIEVEMENTS, applyCase, applyGame, bestByCase, completedAttempts, consultingIQ, liveStreak, dayKey, missions, records } from './engine/progression.js';
import { MODES, start as gameStart, step as gameStep, grade as gameGrade, getSession, dailyMeta } from './games/index.js';
import { aiEnabled } from './engine/ai.js';
import { clean } from './engine/text.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '200kb' }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
const DAY = 86400000;
const err = (status, message, fields) => Object.assign(new Error(message), { status, fields });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((out) => out !== undefined && res.json(out)).catch(next);

// ------------------------------------------------------------------ auth
const hash = (pw, salt = crypto.randomBytes(12).toString('hex')) => `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
const verify = (pw, stored) => { const [salt, h] = String(stored).split(':'); const a = Buffer.from(h || '', 'hex'), b = crypto.scryptSync(pw, salt, 32); return a.length === b.length && crypto.timingSafeEqual(a, b); };
function session(userId) { const token = crypto.randomBytes(24).toString('hex'); col('sessions')[token] = { userId, t: Date.now() }; save(); return token; }
function auth(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, ''); const s = col('sessions')[token];
  const user = s && col('users')[s.userId]; if (!user) return next(err(401, 'Sign in to continue.'));
  req.user = user; next();
}
const prof = (req, _res, next) => (req.user.role === 'professor' ? next() : next(err(403, 'Professor access only.')));
const me = (u) => { const st = rankStatus(u); return { id: u.id, name: u.name, university: u.university, role: u.role, demo: u.demo, xp: u.xp, rank: st.rank.id, rankIndex: st.index, rankName: st.rank.name, streak: liveStreak(u), iq: consultingIQ(u) }; };

app.post('/api/auth/demo', wrap((req) => { const u = col('users')[req.body.role === 'professor' ? 'u_prof' : 'u_demo']; if (!u) throw err(500, 'Demo data missing. Run npm run reset.'); return { token: session(u.id), user: me(u) }; }));
app.post('/api/auth/register', wrap((req) => {
  const name = clean(req.body.name, 60), email = clean(req.body.email, 120).toLowerCase(), pw = String(req.body.password || ''), university = clean(req.body.university, 80) || 'Independent';
  const f = {}; if (name.length < 2) f.name = 'Enter your name.'; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) f.email = 'Enter a valid email.'; if (pw.length < 8) f.password = 'Use at least 8 characters.';
  if (all('users').some((u) => u.email === email)) f.email = 'An account with this email already exists.';
  if (Object.keys(f).length) throw err(400, 'Check the form.', f);
  const u = newUser({ id: uid('u_'), name, email, university, role: req.body.role === 'professor' ? 'professor' : 'student', passHash: hash(pw) }); put('users', u);
  return { token: session(u.id), user: me(u) };
}));
app.post('/api/auth/login', wrap((req) => { const email = clean(req.body.email, 120).toLowerCase(); const u = all('users').find((x) => x.email && x.email === email); if (!u || !verify(String(req.body.password || ''), u.passHash)) throw err(401, 'Email or password is incorrect.'); return { token: session(u.id), user: me(u) }; }));
app.post('/api/auth/logout', auth, wrap((req) => { delete col('sessions')[(req.headers.authorization || '').replace(/^Bearer /, '')]; save(); return { ok: true }; }));
app.get('/api/me', auth, wrap((req) => ({ user: me(req.user), ai: aiEnabled() })));

// ------------------------------------------------------------------ helpers
const weekStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.getTime(); };
const xpSince = (u, t) => u.ledger.filter((l) => l.t >= t && l.source !== 'seed').reduce((s, l) => s + l.amount, 0);
const weekly = (u) => u.seedStats?.weekly ?? xpSince(u, Date.now() - 7 * DAY);
const monthly = (u) => u.seedStats?.monthly ?? xpSince(u, Date.now() - 30 * DAY);
const rankOf = (u) => (u.seedStats ? u.rank : rankStatus(u).rank.id);
const students = () => all('users').filter((u) => u.role === 'student');
const pub = (u) => ({ userId: u.id, name: u.name, university: u.university, demo: u.demo, rank: rankOf(u) });
function board(kind, viewer, skill) {
  let pool = students(); let val = (u) => u.xp;
  if (kind === 'weekly') val = weekly; else if (kind === 'monthly') val = monthly;
  else if (kind === 'friends') pool = pool.filter((u) => u.id === viewer.id || viewer.following.includes(u.id));
  else if (kind === 'skill') val = (u) => Math.round(u.skills[skill] ?? 0);
  else if (kind === 'iq') val = consultingIQ;
  const rows = pool.map((u) => ({ ...pub(u), value: Math.round(val(u)), iq: consultingIQ(u), xp: u.xp, weekly: weekly(u), streak: u.seedStats ? u.streak.current : liveStreak(u), change: u.seedStats?.change ?? 0, you: u.id === viewer.id })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.pos = i + 1));
  return rows;
}
function universityBoard(viewer) {
  const g = {}; for (const u of students()) { const x = (g[u.university] ||= { university: u.university, members: 0, weekly: 0, xp: 0, iq: 0, you: false }); x.members++; x.weekly += weekly(u); x.xp += u.xp; x.iq += consultingIQ(u); if (u.id === viewer.id) x.you = true; }
  return Object.values(g).map((x) => ({ ...x, iq: Math.round(x.iq / x.members), value: x.weekly })).sort((a, b) => b.value - a.value).map((x, i) => ({ ...x, pos: i + 1 }));
}
const STAGE_OF = (a) => (a.phase === 'boardroom' ? 'Boardroom defence' : a.recommendation ? 'Boardroom' : Object.keys(a.quant).length ? 'Workbench' : a.requested.length ? 'Data room' : a.allocCommitted ? 'Hypotheses committed' : a.hypotheses.length ? 'Forming hypotheses' : 'Client brief');
const attemptSummary = (a) => { const c = getCase(a.caseId); return { id: a.id, industry: c.industry, difficulty: c.difficulty, difficultyLabel: c.difficultyLabel, xpReward: c.xpReward, stage: a.status === 'active' ? STAGE_OF(a) : null, hypotheses: a.hypotheses.filter((h) => !h.deleted).length, evidence: a.requested.length + a.cards.length, caseId: a.caseId, title: c.title, company: c.company, status: a.status, startedAt: a.startedAt, completedAt: a.completedAt, overall: a.result ? a.result.override?.score ?? a.result.overall : null, xp: a.result?.xp.total ?? null, hoursUsed: a.hoursUsed, budget: c.budgetHours, seeded: a.seeded }; };
const userAttempts = (uid_) => all('attempts').filter((a) => a.userId === uid_).sort((a, b) => b.startedAt - a.startedAt);
function caseStatus(u) { const out = {}; for (const a of userAttempts(u.id)) { const s = (out[a.caseId] ||= { status: 'new', best: null, attempts: 0, activeId: null }); if (a.status === 'completed') { s.attempts++; const sc = a.result.override?.score ?? a.result.overall; s.best = Math.max(s.best ?? 0, sc); if (s.status !== 'active') s.status = 'completed'; } if (a.status === 'active') { s.status = 'active'; s.activeId = a.id; } } return out; }
function recommend(u, status) {
  const weakest = Object.entries(u.skills).sort((a, b) => a[1] - b[1])[0][0]; const idx = rankStatus(u).index;
  const open = CASES.filter((c) => (c.unlockRank || 0) <= idx);
  const c = open.find((x) => status[x.id]?.status === 'active') || open.find((x) => !status[x.id] && x.skills.includes(weakest)) || open.find((x) => !status[x.id]) || [...open].sort((a, b) => (status[a.id]?.best ?? 0) - (status[b.id]?.best ?? 0))[0];
  const label = SKILLS.find((s) => s.id === weakest).label;
  const why = status[c.id]?.status === 'active' ? 'You have an investigation in progress.' : !status[c.id] ? (c.skills.includes(weakest) ? `Targets ${label.toLowerCase()}, currently your lowest-rated skill.` : 'You have not attempted this case yet.') : `Your best here is ${status[c.id].best}. A second route through the evidence would lift it.`;
  return { case: caseCard(c), why, weakest, weakestLabel: label };
}
function tournament(viewer) {
  const c = getCase('cloudaxis'); const ws = weekStart();
  const rows = students().map((u) => { const mine = u.seedStats ? u.seedStats.tournament : Math.max(0, ...completedAttempts(u.id).filter((a) => a.caseId === c.id && a.completedAt >= ws).map((a) => a.result.overall)); return { ...pub(u), value: mine, you: u.id === viewer.id }; }).filter((r) => r.value > 0 || r.you).sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, pos: i + 1 }));
  return { caseId: c.id, title: c.title, company: c.company, endsAt: ws + 7 * DAY, minRank: 2, entered: rows.find((r) => r.you)?.value > 0, top: rows.slice(0, 8), you: rows.find((r) => r.you) || null, entrants: rows.filter((r) => r.value > 0).length, bonusXp: 250 };
}
function season(u) {
  const done = completedAttempts(u.id); const games = all('games').filter((g) => g.userId === u.id);
  const quests = [
    { label: 'Complete three different cases', cur: new Set(done.map((a) => a.caseId)).size, target: 3 },
    { label: 'Score 80+ on quantitative accuracy in a case', cur: Math.max(0, ...done.map((a) => a.result.skills.quant)), target: 80 },
    { label: 'Hold a 7-day streak', cur: u.streak.best, target: 7 },
    { label: 'Play four different Arena modes', cur: new Set(games.map((g) => g.mode)).size, target: 4 },
    { label: 'Update beliefs correctly 75% of the time in a case', cur: Math.round(Math.max(0, ...done.map((a) => (a.result.updateRate ?? 0) * 100))), target: 75 },
  ].map((q) => ({ ...q, done: q.cur >= q.target }));
  return { name: 'Season 1 — Unit Economics', endsAt: Date.UTC(2026, 11, 31), quests, complete: quests.filter((q) => q.done).length };
}

// ------------------------------------------------------------------ dashboard & catalogue
app.get('/api/dashboard', auth, wrap((req) => {
  const u = req.user; const st = rankStatus(u); const status = caseStatus(u); const g = board('global', u); const w = board('weekly', u);
  const days = Array.from({ length: 14 }, (_, i) => { const t = Date.now() - (13 - i) * DAY; const k = dayKey(t); return { day: k, xp: u.ledger.filter((l) => dayKey(l.t) === k && l.source !== 'seed').reduce((s, l) => s + l.amount, 0) }; });
  const playedToday = all('games').some((x) => x.userId === u.id && x.mode === 'daily' && dayKey(x.t) === dayKey());
  const first = u.skillHistory[0]?.skills;
  return {
    user: me(u), rank: { index: st.index, name: st.rank.name, id: st.rank.id, next: st.next ? { id: st.next.id, name: st.next.name, xp: st.next.xp } : null, progress: st.xpProgress, reqs: st.nextReqs },
    skills: SKILLS.map((s) => ({ id: s.id, label: s.label, value: Math.round(u.skills[s.id]), delta: first ? Math.round(u.skills[s.id] - first[s.id]) : 0 })),
    skillHistory: u.skillHistory.map((h) => ({ t: h.t, iq: Math.round(SKILLS.reduce((t, s) => t + h.skills[s.id] * s.weight, 0)), skills: h.skills })),
    xpDays: days, casesCompleted: completedAttempts(u.id).length, distinctCases: Object.keys(bestByCase(u.id)).length,
    position: { global: g.find((r) => r.you)?.pos, of: g.length, weekly: w.find((r) => r.you)?.pos, weeklyXp: weekly(u), around: g.slice(Math.max(0, (g.find((r) => r.you)?.pos || 1) - 3), (g.find((r) => r.you)?.pos || 1) + 2) },
    daily: { ...dailyMeta(), played: playedToday }, tournament: tournament(u), season: season(u),
    recent: userAttempts(u.id).slice(0, 5).map(attemptSummary), recommended: recommend(u, status),
    achievements: [...u.achievements].sort((a, b) => b.t - a.t).slice(0, 4).map((a) => ({ ...ACHIEVEMENTS.find((x) => x.id === a.id), t: a.t })),
    ledger: [...u.ledger].reverse().slice(0, 6), missions: missions(u),
    active: userAttempts(u.id).filter((a) => a.status === 'active').map(attemptSummary),
    newCases: CASES.filter((c) => !caseStatus(u)[c.id]).map(caseCard),
  };
}));
app.get('/api/cases', auth, wrap((req) => { const st = caseStatus(req.user); const idx = rankStatus(req.user).index; return { cases: CASES.map((c) => ({ ...caseCard(c), locked: (c.unlockRank || 0) > idx, unlockRankName: RANKS[c.unlockRank || 0].name, ...(st[c.id] || { status: 'new', best: null, attempts: 0, activeId: null }) })), recommended: recommend(req.user, st) }; }));
app.get('/api/cases/:id', auth, wrap((req) => { const c = getCase(req.params.id); if (!c) throw err(404, 'Case not found'); const b = caseBrief(c); return { case: { id: b.id, title: b.title, company: b.company, industry: b.industry, func: b.func, problemType: b.problemType, difficultyLabel: b.difficultyLabel, difficulty: b.difficulty, durationMin: b.durationMin, xpReward: b.xpReward, budgetHours: b.budgetHours, skills: b.skills, blurb: b.blurb, briefing: b.briefing, datasetCount: b.datasets.length, stakeholderCount: b.stakeholders.length }, history: userAttempts(req.user.id).filter((a) => a.caseId === c.id).map(attemptSummary) }; }));

// ------------------------------------------------------------------ attempts
const busy = new Set();
const own = (req) => { const a = col('attempts')[req.params.id]; if (!a) throw err(404, 'Attempt not found'); if (a.userId !== req.user.id && req.user.role !== 'professor') throw err(403, 'Not your attempt.'); return a; };
app.post('/api/attempts', auth, wrap((req) => {
  const c = getCase(req.body.caseId); if (!c) throw err(404, 'Case not found');
  if ((c.unlockRank || 0) > rankStatus(req.user).index) throw err(403, `This case unlocks at ${RANKS[c.unlockRank].name}.`);
  const existing = userAttempts(req.user.id).find((a) => a.caseId === c.id && a.status === 'active'); if (existing) return { attempt: view(existing), resumed: true };
  const cls = all('classrooms').find((k) => k.members.some((m) => m.userId === req.user.id) && k.assignments.some((s) => s.caseId === c.id));
  const a = newAttempt(req.user.id, c.id, { classroomId: cls?.id }); put('attempts', a); return { attempt: view(a), resumed: false };
}));
app.get('/api/attempts/:id', auth, wrap((req) => { const a = own(req); return { attempt: view(a) }; }));
app.post('/api/attempts/:id/action', auth, wrap(async (req) => {
  const a = own(req); if (a.userId !== req.user.id) throw err(403, 'Not your attempt.');
  if (busy.has(a.id)) throw err(409, 'Still processing your last action.'); busy.add(a.id);
  try {
    await act(a, String(req.body.type), req.body.payload);
    let applied = null;
    if (a.status === 'completed' && !a.result) {
      const prior = completedAttempts(req.user.id).filter((x) => x.caseId === a.caseId && x.id !== a.id).length;
      const recentAbandons = req.user.abandons.filter((t) => t > Date.now() - 7 * DAY).length;
      finalize(a, { priorCompletions: prior, recentAbandons }); applied = applyCase(req.user, a, getCase(a.caseId)); put('users', req.user);
    }
    put('attempts', a); return { attempt: view(a), completed: Boolean(applied) };
  } finally { busy.delete(a.id); }
}));
app.post('/api/attempts/:id/abandon', auth, wrap((req) => { const a = own(req); if (a.userId !== req.user.id || a.status !== 'active') throw err(400, 'Nothing to abandon.'); a.status = 'abandoned'; a.completedAt = Date.now(); if (a.requested.length || a.hypotheses.length > 1) req.user.abandons.push(Date.now()); put('attempts', a); put('users', req.user); return { ok: true }; }));
app.get('/api/attempts/:id/result', auth, wrap((req) => {
  const a = own(req); if (!a.result) throw err(400, 'This attempt has not been completed.'); const c = getCase(a.caseId); const owner = col('users')[a.userId];
  return { attempt: attemptSummary(a), learner: { name: owner.name, demo: owner.demo }, case: { id: c.id, title: c.title, company: c.company, xpReward: c.xpReward, currency: c.currency }, result: a.result, recommendation: a.recommendation, defence: a.defence,
    hypotheses: a.hypotheses.filter((h) => !h.deleted).map((h) => ({ ...h, driverLabel: c.drivers.find((d) => d.id === h.driver)?.label || 'Other', final: a.alloc[h.id] || 0 })), skillsMeta: SKILLS, ranks: RANKS.map((r) => ({ id: r.id, name: r.name })) };
}));

// ------------------------------------------------------------------ progress, leaderboards, profiles
app.get('/api/progress', auth, wrap((req) => {
  const u = req.user; const st = rankStatus(u);
  return { user: me(u), ladder: st.ladder.map((r) => ({ id: r.id, name: r.name, xp: r.xp, color: r.color, unlocks: r.unlocks, achieved: r.achieved, reqs: r.reqs, index: r.index })), rankIndex: st.index,
    skills: SKILLS.map((s) => ({ id: s.id, label: s.label, value: Math.round(u.skills[s.id]) })), skillHistory: u.skillHistory,
    attempts: userAttempts(u.id).filter((a) => a.status !== 'active' || true).map((a) => ({ ...attemptSummary(a), skills: a.result?.skills || null })),
    games: all('games').filter((g) => g.userId === u.id).sort((a, b) => b.t - a.t).slice(0, 30), ledger: [...u.ledger].reverse().slice(0, 40),
    achievements: ACHIEVEMENTS.map((a) => ({ ...a, earnedAt: u.achievements.find((x) => x.id === a.id)?.t || null })), streak: { current: liveStreak(u), best: u.streak.best }, season: season(u) };
}));
app.get('/api/leaderboards', auth, wrap((req) => {
  const kind = String(req.query.board || 'global'); const skill = SKILLS.some((s) => s.id === req.query.skill) ? req.query.skill : 'structuring';
  if (kind === 'university') return { board: kind, rows: universityBoard(req.user), unit: 'XP this week' };
  const rows = board(kind, req.user, skill); const you = rows.find((r) => r.you);
  return { board: kind, skill, rows: rows.slice(0, 60), you, total: rows.length, unit: kind === 'skill' ? 'rating' : kind === 'weekly' ? 'XP this week' : kind === 'monthly' ? 'XP in 30 days' : 'XP', skills: SKILLS };
}));
app.get('/api/users/:id', auth, wrap((req) => {
  const u = col('users')[req.params.id]; if (!u || u.role !== 'student') throw err(404, 'Learner not found'); const g = board('global', req.user);
  return { profile: { ...pub(u), xp: u.xp, iq: consultingIQ(u), streak: u.seedStats ? u.streak.current : liveStreak(u), bestStreak: u.streak.best, joined: u.createdAt, position: g.find((r) => r.userId === u.id)?.pos, cases: u.seedStats?.cases ?? completedAttempts(u.id).length,
    skills: SKILLS.map((s) => ({ id: s.id, label: s.label, value: Math.round(u.skills[s.id]) })), achievements: u.achievements.map((a) => ({ ...ACHIEVEMENTS.find((x) => x.id === a.id), t: a.t })), best: Object.entries(bestByCase(u.id)).map(([id, score]) => ({ caseId: id, title: getCase(id).title, company: getCase(id).company, score })),
    certificates: u.certificates, following: req.user.following.includes(u.id), isYou: u.id === req.user.id, records: u.seedStats ? null : records(u), history: u.seedStats ? [] : completedAttempts(u.id).sort((a, b) => a.completedAt - b.completedAt).map((a) => ({ t: a.completedAt, score: a.result.override?.score ?? a.result.overall, company: getCase(a.caseId).company, attemptId: u.id === req.user.id ? a.id : null })), challenges: all('challenges').filter((c) => c.fromUserId === u.id || c.toUserId === u.id).length },
  compare: SKILLS.map((s) => ({ id: s.id, label: s.label, you: Math.round(req.user.skills[s.id]), them: Math.round(u.skills[s.id]) })) };
}));
app.post('/api/users/:id/follow', auth, wrap((req) => { const u = col('users')[req.params.id]; if (!u || u.id === req.user.id) throw err(400, 'Cannot follow.'); const f = req.user.following; const i = f.indexOf(u.id); if (i >= 0) f.splice(i, 1); else f.push(u.id); put('users', req.user); return { following: i < 0 }; }));

// ------------------------------------------------------------------ challenges
const challengeView = (c, u) => { const from = col('users')[c.fromUserId], to = col('users')[c.toUserId]; const kase = getCase(c.caseId); const targetBest = Math.max(-1, ...completedAttempts(c.toUserId).filter((a) => a.caseId === c.caseId && a.completedAt >= c.createdAt).map((a) => a.result.overall));
  return { id: c.id, direction: c.toUserId === u.id ? 'received' : 'sent', from: pub(from), to: pub(to), caseId: c.caseId, caseTitle: `${kase.company}: ${kase.title}`, bar: c.bar, note: c.note, createdAt: c.createdAt, status: targetBest < 0 ? 'open' : targetBest > c.bar ? 'beaten' : 'defended', answer: targetBest < 0 ? null : targetBest, demoOpponent: (c.toUserId === u.id ? from : to).demo }; };
app.get('/api/challenges', auth, wrap((req) => ({ challenges: all('challenges').filter((c) => c.fromUserId === req.user.id || c.toUserId === req.user.id).sort((a, b) => b.createdAt - a.createdAt).map((c) => challengeView(c, req.user)), myBest: bestByCase(req.user.id), cases: CASES.map((c) => ({ id: c.id, title: `${c.company}: ${c.title}` })) })));
app.post('/api/challenges', auth, wrap((req) => {
  const to = col('users')[req.body.toUserId]; const c = getCase(req.body.caseId); if (!to || to.role !== 'student' || to.id === req.user.id || !c) throw err(400, 'Choose a learner and a case.');
  const bar = bestByCase(req.user.id)[c.id]; if (bar == null) throw err(400, 'Complete this case yourself before challenging someone on it.');
  if (all('challenges').some((x) => x.fromUserId === req.user.id && x.toUserId === to.id && x.caseId === c.id)) throw err(400, 'You have already sent this challenge.');
  const ch = put('challenges', { id: uid('ch_'), fromUserId: req.user.id, toUserId: to.id, caseId: c.id, bar, createdAt: Date.now(), note: clean(req.body.note, 140) }); return { challenge: challengeView(ch, req.user) };
}));

// ------------------------------------------------------------------ notifications (derived from real records)
app.get('/api/notifications', auth, wrap((req) => {
  const u = req.user; const items = [];
  for (const a of u.achievements) { const m = ACHIEVEMENTS.find((x) => x.id === a.id); items.push({ id: `ach_${a.id}`, kind: 'achievement', t: a.t, title: `Achievement unlocked: ${m.name}`, body: m.desc, to: '/progress' }); }
  for (const c of u.certificates) items.push({ id: `cert_${c.id}`, kind: 'rank', t: c.issuedAt, title: `Certificate issued: ${RANKS.find((r) => r.id === c.rank).name}`, body: `Verification ID ${c.id}`, to: '/certificates' });
  for (const c of all('challenges').filter((x) => x.toUserId === u.id)) { const from = col('users')[c.fromUserId]; items.push({ id: `ch_${c.id}`, kind: 'challenge', t: c.createdAt, title: `${from.name} challenged you`, body: `${getCase(c.caseId).company}: beat ${c.bar}`, to: '/arena' }); }
  for (const cls of all('classrooms').filter((k) => k.members.some((m) => m.userId === u.id))) for (const as of cls.assignments) items.push({ id: `as_${as.id}`, kind: 'assignment', t: as.createdAt, title: `New assignment in ${cls.name}`, body: `${getCase(as.caseId).company} · due ${new Date(as.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, to: '/classroom' });
  items.sort((a, b) => b.t - a.t);
  return { items: items.slice(0, 20) };
}));

// ------------------------------------------------------------------ certificates
const certView = (c) => ({ ...c, issuer: 'Consult Brain', disclaimer: 'A Consult Brain achievement certificate. It is not an academic qualification and is not issued or accredited by any university or professional body.', skillsMeta: SKILLS });
app.get('/api/certificates', auth, wrap((req) => { const st = rankStatus(req.user); return { certificates: req.user.certificates.map((x) => certView(col('certificates')[x.id])).filter(Boolean).sort((a, b) => b.issuedAt - a.issuedAt), next: st.next ? { name: st.next.name, reqs: st.nextReqs } : null }; }));
app.get('/api/verify/:code', wrap((req) => { const c = col('certificates')[String(req.params.code).toUpperCase()]; if (!c) throw err(404, 'No certificate with this identifier.'); return { certificate: certView(c) }; }));

// ------------------------------------------------------------------ arena
app.get('/api/games', auth, wrap((req) => {
  const idx = rankStatus(req.user).index; const mine = all('games').filter((g) => g.userId === req.user.id); const today = dayKey();
  return { modes: MODES.map((m) => { const g = mine.filter((x) => x.mode === m.id); return { ...m, locked: m.minRank > idx, minRankName: RANKS[m.minRank].name, best: g.length ? Math.max(...g.map((x) => x.score)) : null, plays: g.length, playsToday: g.filter((x) => dayKey(x.t) === today).length, skillLabels: m.skills.map((s) => SKILLS.find((k) => k.id === s).label) }; }),
    tournament: tournament(req.user), season: season(req.user), streak: liveStreak(req.user), missions: missions(req.user) };
}));
const modeGate = (req) => { const m = MODES.find((x) => x.id === req.params.mode); if (!m) throw err(404, 'Unknown mode'); if (m.minRank > rankStatus(req.user).index) throw err(403, `${m.name} unlocks at ${RANKS[m.minRank].name}.`); return m; };
app.post('/api/games/:mode/start', auth, wrap((req) => { modeGate(req); return { puzzle: gameStart(req.params.mode, req.user, req.body || {}) }; }));
app.post('/api/games/:mode/step', auth, wrap((req) => { const s = getSession(req.body.sessionId, req.user.id); if (!s || s.mode !== req.params.mode) throw err(404, 'Session expired. Start again.'); return gameStep(s, req.body); }));
app.post('/api/games/:mode/submit', auth, wrap((req) => {
  const s = getSession(req.body.sessionId, req.user.id); if (!s || s.mode !== req.params.mode) throw err(404, 'Session expired. Start again.');
  const g = gameGrade(s, req.body.answer || {}); const applied = applyGame(req.user, s.mode, g);
  put('games', { id: uid('g_'), userId: req.user.id, mode: s.mode, score: g.score, earned: applied.earned, t: Date.now() }); put('users', req.user);
  return { score: g.score, feedback: g.feedback, applied: { ...applied, deltas: applied.deltas.map((d) => ({ ...d, label: SKILLS.find((k) => k.id === d.skill).label })) }, user: me(req.user) };
}));

// ------------------------------------------------------------------ classroom
const FLAG_LABEL = { anchoring: 'Did not update beliefs when evidence arrived', premature_certainty: 'Committed to one hypothesis before seeing data', unfocused_requests: 'Spent hours on data that could not discriminate', missed_decisive_evidence: 'Never obtained the decisive evidence', unquantified_recommendation: 'Recommended without sizing the problem', data_before_hypotheses: 'Opened the data room without competing hypotheses', weak_strategic_choice: 'Recommendation does not address the diagnosed cause' };
const clsOf = (req) => { const c = col('classrooms')[req.params.id]; if (!c) throw err(404, 'Classroom not found'); if (c.profId !== req.user.id) throw err(403, 'Not your classroom.'); return c; };
const latestFor = (cls, userId, caseId) => all('attempts').filter((a) => a.userId === userId && a.caseId === caseId && a.status !== 'abandoned').sort((a, b) => (b.status === 'completed') - (a.status === 'completed') || (b.result?.overall ?? 0) - (a.result?.overall ?? 0) || b.startedAt - a.startedAt)[0];
app.get('/api/classrooms', auth, wrap((req) => {
  if (req.user.role === 'professor') return { role: 'professor', classrooms: all('classrooms').filter((c) => c.profId === req.user.id).map((c) => ({ id: c.id, name: c.name, code: c.code, demo: c.demo, students: c.members.length, assignments: c.assignments.length })) , cases: CASES.map(caseCard) };
  const st = caseStatus(req.user);
  return { role: 'student', classrooms: all('classrooms').filter((c) => c.members.some((m) => m.userId === req.user.id)).map((c) => ({ id: c.id, name: c.name, demo: c.demo, professor: col('users')[c.profId]?.name, team: c.members.find((m) => m.userId === req.user.id).team, classmates: c.members.length,
    assignments: c.assignments.map((s) => ({ ...s, case: caseCard(getCase(s.caseId)), ...(st[s.caseId] || { status: 'new', best: null }) })) })) };
}));
app.post('/api/classrooms', auth, prof, wrap((req) => { const name = clean(req.body.name, 80); if (name.length < 3) throw err(400, 'Give the classroom a name.'); const c = put('classrooms', { id: uid('cls_'), name, code: crypto.randomBytes(3).toString('hex').toUpperCase(), profId: req.user.id, demo: false, createdAt: Date.now(), assignments: [], members: [] }); return { id: c.id }; }));
app.post('/api/classrooms/join', auth, wrap((req) => { const code = clean(req.body.code, 20).toUpperCase(); const c = all('classrooms').find((x) => x.code.toUpperCase() === code); if (!c) throw err(404, 'No classroom with that join code.'); if (req.user.role !== 'student') throw err(400, 'Only student accounts can join.'); if (!c.members.some((m) => m.userId === req.user.id)) { c.members.push({ userId: req.user.id, team: clean(req.body.team, 40) || 'Unassigned' }); put('classrooms', c); } return { id: c.id, name: c.name }; }));
app.post('/api/classrooms/:id/assign', auth, prof, wrap((req) => { const c = clsOf(req); const k = getCase(req.body.caseId); const due = Number(req.body.due); if (!k) throw err(400, 'Choose a case.'); if (!Number.isFinite(due) || due < Date.now()) throw err(400, 'Choose a deadline in the future.'); if (c.assignments.some((a) => a.caseId === k.id)) throw err(400, 'This case is already assigned.'); c.assignments.push({ id: uid('as_'), caseId: k.id, due, createdAt: Date.now(), note: clean(req.body.note, 300) }); put('classrooms', c); return { ok: true }; }));
app.post('/api/classrooms/:id/team', auth, prof, wrap((req) => { const c = clsOf(req); const m = c.members.find((x) => x.userId === req.body.userId); if (!m) throw err(404, 'Not a member.'); m.team = clean(req.body.team, 40) || 'Unassigned'; put('classrooms', c); return { ok: true }; }));
function analytics(c, caseId) {
  const k = getCase(caseId); const rows = c.members.map((m) => { const u = col('users')[m.userId]; const a = latestFor(c, m.userId, caseId); const r = a?.result;
    return { userId: u.id, name: u.name, demo: u.demo, team: m.team, status: !a ? 'not_started' : a.status === 'completed' ? 'completed' : 'in_progress', attemptId: a?.id || null, engine: r?.overall ?? null, overall: r ? r.override?.score ?? r.overall : null, override: r?.override || null,
      skills: r?.skills || null, flags: r?.flags || [], hours: a?.hoursUsed ?? null, option: r?.option || null, diagnosis: r?.diagnosis?.label || null, requested: a?.requested || [], updateRate: r?.updateRate ?? null,
      opening: r?.replay.snapshots[0]?.byDriver || null, closing: r?.replay.snapshots.at(-1)?.byDriver || null, rec: a?.recommendation ? { diagnosis: a.recommendation.diagnosis, rationale: a.recommendation.rationale, impact: a.recommendation.impact, optionLabel: a.recommendation.optionLabel, risks: a.recommendation.risks } : null, completedAt: a?.completedAt || null }; });
  const done = rows.filter((r) => r.status === 'completed'); const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const dist = (key) => Object.fromEntries(k.drivers.map((d) => [d.id, avg(done.map((r) => r[key]?.[d.id] || 0)) ?? 0]));
  const teams = [...new Set(c.members.map((m) => m.team))].map((t) => { const rs = rows.filter((r) => r.team === t), ds = rs.filter((r) => r.status === 'completed'); return { team: t, members: rs.length, completed: ds.length, overall: avg(ds.map((r) => r.overall)), skills: Object.fromEntries(SKILLS.map((s) => [s.id, avg(ds.map((r) => r.skills[s.id]))])), topOption: ds.length ? Object.entries(ds.reduce((o, r) => ((o[r.option.label] = (o[r.option.label] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1])[0][0] : null }; });
  return { case: { id: k.id, title: k.title, company: k.company }, rows, teams, completion: { completed: done.length, inProgress: rows.filter((r) => r.status === 'in_progress').length, notStarted: rows.filter((r) => r.status === 'not_started').length, total: rows.length },
    classAvg: { overall: avg(done.map((r) => r.overall)), skills: Object.fromEntries(SKILLS.map((s) => [s.id, avg(done.map((r) => r.skills[s.id]))])) },
    hypotheses: { drivers: k.drivers.map((d) => ({ id: d.id, label: d.label })), opening: dist('opening'), closing: dist('closing'), evidenceWeighted: Object.fromEntries(k.drivers.map((d) => [d.id, Math.round(d.truth * 100)])) },
    trails: { datasets: k.datasets.map((d) => ({ id: d.id, title: d.title, value: d.value, cost: d.cost, requestedBy: done.filter((r) => r.requested.includes(d.id)).length })), rows: done.map((r) => ({ userId: r.userId, name: r.name, team: r.team, overall: r.overall, order: Object.fromEntries(r.requested.map((id, i) => [id, i + 1])) })) },
    failures: Object.entries(FLAG_LABEL).map(([id, label]) => ({ id, label, count: done.filter((r) => r.flags.includes(id)).length, share: done.length ? Math.round((done.filter((r) => r.flags.includes(id)).length / done.length) * 100) : 0, who: done.filter((r) => r.flags.includes(id)).map((r) => r.name) })).filter((f) => f.count).sort((a, b) => b.count - a.count),
    options: k.options.map((o) => ({ id: o.id, label: o.label, count: done.filter((r) => r.option?.id === o.id).length })).filter((o) => o.count), skillsMeta: SKILLS };
}
app.get('/api/classrooms/:id', auth, prof, wrap((req) => { const c = clsOf(req); const caseId = c.assignments.some((a) => a.caseId === req.query.caseId) ? req.query.caseId : c.assignments[0]?.caseId;
  return { classroom: { id: c.id, name: c.name, code: c.code, demo: c.demo, members: c.members.map((m) => ({ ...m, name: col('users')[m.userId].name, demo: col('users')[m.userId].demo })), assignments: c.assignments.map((a) => ({ ...a, title: `${getCase(a.caseId).company}: ${getCase(a.caseId).title}` })) }, cases: CASES.map(caseCard), analytics: caseId ? analytics(c, caseId) : null }; }));
app.post('/api/classrooms/:id/override', auth, prof, wrap((req) => { const c = clsOf(req); const a = col('attempts')[req.body.attemptId]; if (!a?.result || !c.members.some((m) => m.userId === a.userId)) throw err(404, 'Attempt not found in this classroom.');
  if (req.body.clear) a.result.override = null; else { const score = Math.round(Number(req.body.score)); if (!Number.isFinite(score) || score < 0 || score > 100) throw err(400, 'Enter a score from 0 to 100.'); const note = clean(req.body.note, 400); if (note.length < 5) throw err(400, 'Record the reason for the override.'); a.result.override = { score, note, by: req.user.name, t: Date.now() }; }
  put('attempts', a); return { override: a.result.override }; }));
app.get('/api/classrooms/:id/export.csv', auth, prof, (req, res, next) => { try { const c = clsOf(req); const caseId = c.assignments.some((a) => a.caseId === req.query.caseId) ? req.query.caseId : c.assignments[0]?.caseId; if (!caseId) throw err(400, 'No assignment to export.'); const an = analytics(c, caseId);
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; const head = ['Student', 'Team', 'Status', 'Final score', 'Engine score', 'Override note', ...SKILLS.map((s) => s.label), 'Analyst hours', 'Recommendation', 'Diagnosis matched', 'Reasoning flags'];
  const lines = an.rows.map((r) => [r.name, r.team, r.status, r.overall, r.engine, r.override?.note, ...SKILLS.map((s) => r.skills?.[s.id]), r.hours, r.option?.label, r.diagnosis, r.flags.map((f) => FLAG_LABEL[f]).join('; ')].map(q).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="consult-brain-${c.code}-${caseId}.csv"`); res.send('﻿' + [head.map(q).join(','), ...lines].join('\n')); } catch (e) { next(e); } });
// Live session: where each team is right now. `playback` (0..1) replays seeded demo trails so the view can be shown without a live class.
app.get('/api/classrooms/:id/live', auth, prof, wrap((req) => {
  const c = clsOf(req); const caseId = c.assignments.some((a) => a.caseId === req.query.caseId) ? req.query.caseId : c.assignments[0]?.caseId; if (!caseId) return { teams: [] }; const k = getCase(caseId);
  const pb = req.query.playback != null ? Math.max(0, Math.min(1, Number(req.query.playback))) : null;
  const rows = c.members.map((m) => { const u = col('users')[m.userId]; const a = latestFor(c, m.userId, caseId); if (!a) return { name: u.name, team: m.team, stage: 'Not started', hours: 0, requested: [], top: null, step: 0 };
    const useSlice = pb != null && a.seeded; const ev = useSlice ? a.events.slice(0, Math.max(1, Math.round(a.events.length * pb))) : a.events;
    const snap = [...ev].reverse().find((e) => e.type === 'conf_commit' || e.type === 'conf_hold'); const top = snap ? Object.entries(snap.byDriver).sort((x, y) => y[1] - x[1])[0] : null;
    const req_ = ev.filter((e) => e.type === 'data_request'); const last = ev.at(-1).type;
    const stage = ev.some((e) => e.type === 'complete') ? 'Completed' : ev.some((e) => e.type === 'submit_rec') ? 'Boardroom defence' : req_.length || ev.some((e) => e.type === 'interview_start') ? (last === 'quant_answer' || last === 'calc' || last === 'scenario' ? 'Workbench' : last.startsWith('interview') ? 'Interviewing' : 'Data room') : snap ? 'Hypotheses committed' : ev.length > 1 ? 'Forming hypotheses' : 'Reading the brief';
    return { name: u.name, team: m.team, stage, hours: req_.reduce((s, e) => s + e.cost, 0) + ev.filter((e) => e.type === 'interview_start').reduce((s, e) => s + e.cost, 0), requested: req_.map((e) => k.datasets.find((d) => d.id === e.datasetId).title), top: top ? { label: k.drivers.find((d) => d.id === top[0])?.label || 'Other', pts: top[1] } : null, step: ev.length, live: !a.seeded }; });
  const teams = [...new Set(c.members.map((m) => m.team))].map((t) => ({ team: t, members: rows.filter((r) => r.team === t) }));
  return { budget: k.budgetHours, teams, playback: pb, caseTitle: `${k.company}: ${k.title}` };
}));

// ------------------------------------------------------------------ static + errors
const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
app.use('/api', (_req, _res, next) => next(err(404, 'Not found')));
app.use((e, _req, res, _next) => { const status = e instanceof ActionError ? 400 : e.status || 500; if (status >= 500) console.error(e); res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : e.message, fields: e.fields || null }); });

const PORT = Number(process.env.PORT) || 8787;
await seed();
app.listen(PORT, () => console.log(`Consult Brain API on http://localhost:${PORT}  ·  AI assistance: ${aiEnabled() ? 'on' : 'off (deterministic fallbacks)'}`));
