// Progression engine: XP ledger, six ranks with balanced-skill gates, skill ratings,
// streaks, achievements and milestone certificates (Consult Brain-issued; not an academic accreditation).
import crypto from 'node:crypto';
import { CASES } from '../cases/index.js';
import { SKILLS } from './scoring.js';
import { all, put } from '../store.js';

export const RANKS = [
  { id: 'bronze', name: 'Bronze', xp: 0, minSkill: 0, color: '#B8794A', unlocks: ['Brewly and Northstar cases', 'Daily Diagnostic', 'Issue Tree Arena', 'Margin Detective'] },
  { id: 'silver', name: 'Silver', xp: 800, minSkill: 35, cases: 1, color: '#AEB7C2', unlocks: ['CloudAxis (expert case)', 'Hypothesis Duel', 'Boardroom Blitz'] },
  { id: 'gold', name: 'Gold', xp: 2200, minSkill: 48, cases: 2, color: '#E2B84A', unlocks: ['Market Strategy Challenge', 'Weekly tournament entry'] },
  { id: 'master', name: 'Master', xp: 4500, minSkill: 60, cases: 3, hard: { n: 1, score: 70 }, color: '#D9605A', unlocks: ['Master division on leaderboards', 'Master certificate'] },
  { id: 'expert', name: 'Expert', xp: 8000, minSkill: 70, cases: 3, hard: { n: 2, score: 80 }, avgBest: 75, color: '#45B5A4', unlocks: ['Expert division', 'Expert certificate'] },
  { id: 'grandmaster', name: 'Grandmaster', xp: 14000, minSkill: 80, cases: 3, hard: { n: 2, score: 88 }, avgBest: 85, bestStreak: 14, color: '#F1E9D8', unlocks: ['Grandmaster hall of fame', 'Grandmaster certificate'] },
];
export const ACHIEVEMENTS = [
  { id: 'first_diagnosis', name: 'First Diagnosis', desc: 'Complete a full investigation and defend it.' },
  { id: 'evidence_hunter', name: 'Evidence Hunter', desc: 'Score 85+ on evidence efficiency in a case.' },
  { id: 'quant_specialist', name: 'Quant Specialist', desc: 'Answer every workbench calculation correctly on the first attempt.' },
  { id: 'calibration_master', name: 'Calibration Master', desc: 'Score 85+ on calibration in a case.' },
  { id: 'boardroom_survivor', name: 'Boardroom Survivor', desc: 'Score 70+ in a boardroom defence.' },
  { id: 'perfect_investigation', name: 'Perfect Investigation', desc: 'Obtain every decisive dataset without a single low-value request.' },
  { id: 'consistency_champion', name: 'Consistency Champion', desc: 'Hold a seven-day activity streak.' },
  { id: 'mind_changer', name: 'Mind Changer', desc: 'Add a hypothesis mid-investigation that becomes your diagnosis.' },
  { id: 'triple_industry', name: 'Cross-Industry', desc: 'Complete cases in three different industries.' },
  { id: 'mece_architect', name: 'MECE Architect', desc: 'Score 85+ in the Issue Tree Arena.' },
];
const DAY = 86400000;
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export function newUser({ id, name, email = null, university = 'Independent', role = 'student', demo = false, passHash = null }) {
  return { id, name, email, university, role, demo, passHash, createdAt: Date.now(), xp: 0, ledger: [], skills: Object.fromEntries(SKILLS.map((s) => [s.id, 25])), skillHistory: [],
    streak: { current: 0, best: 0, lastDay: null }, achievements: [], certificates: [], following: [], abandons: [], rank: 'bronze', prevRank: 0, classrooms: [] };
}

export function completedAttempts(userId) { return all('attempts').filter((a) => a.userId === userId && a.status === 'completed' && a.result); }
export function bestByCase(userId) { const b = {}; for (const a of completedAttempts(userId)) { const s = a.result.override?.score ?? a.result.overall; if (!(a.caseId in b) || s > b[a.caseId]) b[a.caseId] = s; } return b; }

export function rankStatus(user) {
  const best = bestByCase(user.id); const done = Object.keys(best);
  const minSkill = Math.min(...Object.values(user.skills));
  const hardScores = CASES.filter((c) => c.difficulty >= 3).map((c) => best[c.id] || 0).sort((a, b) => b - a);
  const avgBest = done.length ? Math.round(done.reduce((s, k) => s + best[k], 0) / done.length) : 0;
  const reqs = (r) => {
    const out = [{ label: `${r.xp.toLocaleString()} XP`, met: user.xp >= r.xp, current: user.xp, target: r.xp }];
    if (r.minSkill) out.push({ label: `Every skill rated ${r.minSkill}+`, met: minSkill >= r.minSkill, current: Math.round(minSkill), target: r.minSkill });
    if (r.cases) out.push({ label: `${r.cases} different case${r.cases > 1 ? 's' : ''} completed`, met: done.length >= r.cases, current: done.length, target: r.cases });
    if (r.hard) out.push({ label: `${r.hard.n} advanced case${r.hard.n > 1 ? 's' : ''} scored ${r.hard.score}+`, met: hardScores.filter((s) => s >= r.hard.score).length >= r.hard.n, current: hardScores.filter((s) => s >= r.hard.score).length, target: r.hard.n });
    if (r.avgBest) out.push({ label: `Average best score ${r.avgBest}+`, met: avgBest >= r.avgBest, current: avgBest, target: r.avgBest });
    if (r.bestStreak) out.push({ label: `${r.bestStreak}-day streak achieved`, met: user.streak.best >= r.bestStreak, current: user.streak.best, target: r.bestStreak });
    return out;
  };
  let idx = 0;
  for (let i = 1; i < RANKS.length; i++) { if (reqs(RANKS[i]).every((q) => q.met)) idx = i; else break; }
  const next = RANKS[idx + 1] || null;
  return { index: idx, rank: RANKS[idx], next, nextReqs: next ? reqs(next) : [], xpProgress: next ? Math.min(1, (user.xp - RANKS[idx].xp) / (next.xp - RANKS[idx].xp)) : 1,
    ladder: RANKS.map((r, i) => ({ ...r, index: i, achieved: i <= idx, reqs: reqs(r) })) };
}

export function touchStreak(user, t = Date.now()) {
  const today = dayKey(t); const s = user.streak;
  if (s.lastDay === today) return false;
  s.current = s.lastDay === dayKey(t - DAY) ? s.current + 1 : 1; s.lastDay = today; s.best = Math.max(s.best, s.current);
  return true;
}
export function liveStreak(user) { const s = user.streak; return s.lastDay === dayKey() || s.lastDay === dayKey(Date.now() - DAY) ? s.current : 0; }

export function addXp(user, amount, source, label, detail = null, t = Date.now()) {
  amount = Math.round(amount); user.xp = Math.max(0, user.xp + amount);
  user.ledger.push({ t, source, label, amount, detail }); if (user.ledger.length > 400) user.ledger.shift();
}
export function updateSkill(user, skill, score, k, t = Date.now()) {
  const before = user.skills[skill]; user.skills[skill] = Math.round((before + k * (score - before)) * 10) / 10;
  return { skill, before, after: user.skills[skill] };
}
function grant(user, id, out, t = Date.now()) { if (!user.achievements.some((a) => a.id === id)) { user.achievements.push({ id, t }); out.push(ACHIEVEMENTS.find((a) => a.id === id)); } }

function issueCertificates(user, t = Date.now()) {
  const st = rankStatus(user); const issued = [];
  for (let i = 1; i <= st.index; i++) {
    const r = RANKS[i]; if (user.certificates.some((c) => c.rank === r.id)) continue;
    const code = 'CB-' + crypto.createHash('sha256').update(`${user.id}:${r.id}:${t}`).digest('hex').slice(0, 10).toUpperCase().replace(/(.{5})/, '$1-');
    const cert = { id: code, userId: user.id, name: user.name, rank: r.id, rankName: r.name, issuedAt: t, skills: { ...user.skills }, cases: Object.keys(bestByCase(user.id)).length, demo: user.demo };
    put('certificates', cert); user.certificates.push({ id: code, rank: r.id, issuedAt: t }); issued.push(cert);
  }
  user.rank = st.rank.id;
  return { status: st, issued };
}

// Applies a completed, scored case attempt to the learner's record. Server-side only.
export function applyCase(user, attempt, c) {
  const r = attempt.result; const t = attempt.completedAt || Date.now(); const before = rankStatus(user).index;
  const k = Math.min(0.45, 0.2 + 0.05 * c.difficulty) * (r.lowEffort ? 0.3 : 1);
  const deltas = SKILLS.map((s) => updateSkill(user, s.id, r.skills[s.id], k, t));
  user.skillHistory.push({ t, skills: { ...user.skills }, source: c.id }); if (user.skillHistory.length > 60) user.skillHistory.shift();
  addXp(user, r.xp.total, 'case', `${c.company}: ${c.title}`, { attemptId: attempt.id, overall: r.overall }, t);
  touchStreak(user, t);
  const ach = [];
  grant(user, 'first_diagnosis', ach, t);
  if (r.skills.evidence >= 85) grant(user, 'evidence_hunter', ach, t);
  if (c.quant.every((q) => attempt.quant[q.id]?.firstTry)) grant(user, 'quant_specialist', ach, t);
  if (r.skills.calibration >= 85) grant(user, 'calibration_master', ach, t);
  if (r.boardroom >= 70) grant(user, 'boardroom_survivor', ach, t);
  if (!r.replay.unnecessary.length && c.datasets.filter((d) => d.value === 'critical').every((d) => attempt.requested.includes(d.id))) grant(user, 'perfect_investigation', ach, t);
  if (attempt.recommendation.leadHypIds.some((id) => attempt.hypotheses.find((h) => h.id === id && !h.preData)) && r.diagnosis) grant(user, 'mind_changer', ach, t);
  if (new Set(completedAttempts(user.id).map((a) => CASES.find((x) => x.id === a.caseId).industry)).size >= 3) grant(user, 'triple_industry', ach, t);
  if (user.streak.best >= 7) grant(user, 'consistency_champion', ach, t);
  const { status, issued } = issueCertificates(user, t);
  r.applied = { deltas, achievements: ach, rankBefore: before, rankAfter: status.index, certificates: issued.map((x) => x.id), xpAfter: user.xp };
  return r.applied;
}

// Mini-game result: capped daily XP per mode prevents farming; first play of the day earns in full.
export function applyGame(user, mode, { score, xp, skills, label }, t = Date.now()) {
  const today = dayKey(t); const plays = all('games').filter((g) => g.userId === user.id && g.mode === mode && dayKey(g.t) === today).length;
  const factor = plays === 0 ? 1 : plays === 1 ? 0.4 : plays === 2 ? 0.15 : 0;
  const before = rankStatus(user).index; const earned = Math.round(xp * (score / 100) * factor);
  const deltas = skills.map((s) => updateSkill(user, s, score, plays === 0 ? 0.1 : 0.03, t));
  const newDay = touchStreak(user, t); let streakBonus = 0;
  if (newDay && user.streak.current > 1) { streakBonus = Math.min(50, 5 * user.streak.current); addXp(user, streakBonus, 'streak', `${user.streak.current}-day streak`, null, t); }
  if (earned) addXp(user, earned, 'game', label, { mode, score }, t);
  const ach = []; if (user.streak.best >= 7) grant(user, 'consistency_champion', ach, t); if (mode === 'issue-tree' && score >= 85) grant(user, 'mece_architect', ach, t);
  const { status, issued } = issueCertificates(user, t);
  return { earned, factor, streakBonus, plays: plays + 1, deltas, achievements: ach, rankBefore: before, rankAfter: status.index, certificates: issued.map((x) => x.id), streak: user.streak.current };
}
export function consultingIQ(user) { return Math.round(SKILLS.reduce((s, k) => s + user.skills[k.id] * k.weight, 0)); }
export { dayKey };

// Daily and weekly missions, computed from real activity only.
export function missions(user) {
  const DAYMS = 86400000; const today = dayKey();
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const ws = d.getTime();
  const games = all('games').filter((g) => g.userId === user.id && !g.seeded);
  const atts = all('attempts').filter((a) => a.userId === user.id && !a.seeded);
  const gToday = games.filter((g) => dayKey(g.t) === today), gWeek = games.filter((g) => g.t >= ws);
  const commitsToday = atts.reduce((n, a) => n + a.events.filter((e) => e.type === 'conf_commit' && dayKey(e.t) === today).length, 0);
  const doneWeek = atts.filter((a) => a.status === 'completed' && a.completedAt >= ws);
  const m = (id, label, cur, target, xp, to) => ({ id, label, cur: Math.min(cur, target), target, done: cur >= target, xp, to });
  return {
    daily: [
      m('d_diag', 'Solve today\'s Daily Diagnostic', gToday.filter((g) => g.mode === 'daily').length, 1, 60, '/daily'),
      m('d_arena', 'Play two different Arena modes', new Set(gToday.map((g) => g.mode)).size, 2, 0, '/arena'),
      m('d_update', 'Commit three evidence-driven belief updates', commitsToday, 3, 0, '/vault'),
    ],
    weekly: [
      m('w_case', 'Complete an investigation', doneWeek.length, 1, 0, '/vault'),
      m('w_quality', 'Score 75+ on a case this week', Math.max(0, ...doneWeek.map((a) => a.result.overall)) >= 75 ? 1 : 0, 1, 0, '/vault'),
      m('w_modes', 'Try four Arena modes this week', new Set(gWeek.map((g) => g.mode)).size, 4, 0, '/arena'),
      m('w_streak', 'Keep a five-day streak', liveStreakOf(user), 5, 0, '/daily'),
    ],
    resetsAt: { daily: new Date(today + 'T00:00:00Z').getTime() + DAYMS, weekly: ws + 7 * DAYMS },
    note: 'Missions track real activity. They point you to work worth doing; only the Daily Diagnostic itself awards XP.',
  };
}
function liveStreakOf(u) { const s = u.streak; return s.lastDay === dayKey() || s.lastDay === dayKey(Date.now() - 86400000) ? s.current : 0; }
export function records(user) {
  const atts = completedAttempts(user.id); const games = all('games').filter((g) => g.userId === user.id);
  const bestAtt = atts.reduce((b, a) => (!b || a.result.overall > b.result.overall ? a : b), null);
  const bestXp = atts.reduce((b, a) => (!b || a.result.xp.total > b.result.xp.total ? a : b), null);
  const modes = {}; for (const g of games) modes[g.mode] = Math.max(modes[g.mode] ?? 0, g.score);
  return {
    bestCase: bestAtt ? { score: bestAtt.result.overall, caseId: bestAtt.caseId, attemptId: bestAtt.id, t: bestAtt.completedAt } : null,
    mostXp: bestXp ? { xp: bestXp.result.xp.total, caseId: bestXp.caseId, attemptId: bestXp.id } : null,
    bestStreak: user.streak.best, arena: modes,
    peakSkills: Object.fromEntries(Object.keys(user.skills).map((k) => [k, Math.round(Math.max(user.skills[k], ...user.skillHistory.map((h) => h.skills[k] ?? 0)))])),
  };
}
