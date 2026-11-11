// Seed data. Everything created here is flagged demo:true and labelled as such in the UI.
// Demo learners' case attempts are produced by running the real engine with scripted archetypes.
import { load, put, reset, flush, all } from './store.js';
import { newUser, applyCase, applyGame, addXp, RANKS, dayKey } from './engine/progression.js';
import { simulate, ARCHETYPES } from './engine/simulate.js';
import { getCase } from './cases/index.js';
import { SKILLS } from './engine/scoring.js';

const DAY = 86400000;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const FIRST = ['Ishaan', 'Tara', 'Kabir', 'Naina', 'Dev', 'Sanya', 'Rohan', 'Meher', 'Arnav', 'Diya', 'Vihaan', 'Zoya', 'Aarav', 'Ira', 'Neil', 'Anika', 'Yash', 'Mira', 'Kunal', 'Rhea', 'Samar', 'Tanvi', 'Aditya', 'Pia', 'Varun', 'Sara', 'Nikhil', 'Leela', 'Omar', 'Jiya', 'Reyansh', 'Aisha', 'Karan', 'Nitya', 'Veer', 'Esha'];
const LAST = ['Menon', 'Bhatia', 'Reddy', 'Ghosh', 'Pillai', 'Chopra', 'Jain', 'Nair', 'Saxena', 'Fernandes', 'Kulkarni', 'Sethi', 'Banerjee', 'Hegde', 'Arora', 'Thomas', 'Verma', 'Shetty'];
const UNIS = ['IIM Bangalore', 'IIM Calcutta', 'ISB Hyderabad', 'Christ University', 'SRCC Delhi', 'IIT Madras', 'XLRI Jamshedpur', 'St. Stephen\'s College'];
const rankFor = (xp, minSkill) => { let i = 0; for (let k = 1; k < RANKS.length; k++) if (xp >= RANKS[k].xp && minSkill >= RANKS[k].minSkill) i = k; else break; return RANKS[i].id; };

export async function seed({ force = false } = {}) {
  if (load().meta.seededAt && !force) return false;
  const db = force ? reset() : load();
  const now = Date.now(); const r = rng(20261111);

  // --- Leaderboard population
  for (let i = 0; i < 36; i++) {
    const u = newUser({ id: `u_seed${i}`, name: `${FIRST[i]} ${LAST[(i * 7) % LAST.length]}`, university: UNIS[i % UNIS.length], demo: true });
    const tier = i < 2 ? 5 : i < 5 ? 4 : i < 11 ? 3 : i < 20 ? 2 : i < 29 ? 1 : 0;
    const lo = RANKS[tier].xp, hi = RANKS[tier + 1]?.xp || 19000;
    u.xp = Math.round(lo + (hi - lo) * (0.1 + 0.85 * r()));
    const base = Math.max(30, RANKS[tier].minSkill + 4);
    for (const s of SKILLS) u.skills[s.id] = Math.min(97, Math.round(base + r() * 16));
    u.rank = rankFor(u.xp, Math.min(...Object.values(u.skills)));
    u.seedStats = { weekly: Math.round(120 + r() * 900 + tier * 60), monthly: Math.round(400 + r() * 1700 + tier * 150), cases: 2 + tier * 2 + Math.floor(r() * 4), change: Math.floor(r() * 7) - 3, tournament: Math.round(52 + r() * 40) };
    u.streak = { current: Math.floor(r() * (4 + tier * 4)), best: 3 + tier * 4, lastDay: dayKey(now - DAY) };
    put('users', u);
  }

  // --- Professor and classroom
  const prof = newUser({ id: 'u_prof', name: 'Prof. Meenakshi Iyer', university: 'Demo Business School', role: 'professor', demo: true }); put('users', prof);
  const cls = { id: 'cls_demo', name: 'MBA Strategy — Section B', code: 'STRAT-B26', profId: prof.id, demo: true, createdAt: now - 9 * DAY,
    assignments: [{ id: 'as_1', caseId: 'brewly', due: now + 5 * DAY, createdAt: now - 4 * DAY, note: 'Complete individually before Thursday\'s session. We will compare investigation trails in class.' }], members: [] };
  const TEAMS = ['Team Kaveri', 'Team Godavari', 'Team Narmada', 'Team Tapti', 'Team Krishna', 'Team Sabarmati'];
  const plan = [['expert', 'customer', 'latecomer'], ['hoarder', 'quantweak', 'expert'], ['anchored', 'fixedcost', 'hoarder'], ['customer', 'latecomer', 'quantweak'], ['fixedcost', 'anchored', null], ['quantweak', 'hoarder', null]];
  let k = 0;
  for (const [ti, arcs] of plan.entries()) for (const arc of arcs) {
    const u = newUser({ id: `u_cls${k}`, name: `${FIRST[35 - k]} ${LAST[(k * 5 + 3) % LAST.length]}`, university: 'Demo Business School', demo: true }); u.classrooms.push(cls.id); put('users', u);
    cls.members.push({ userId: u.id, team: TEAMS[ti] });
    if (arc) {
      const p = JSON.parse(JSON.stringify(ARCHETYPES.brewly[arc]));
      if (k % 3 === 1 && p.steps.length > 5) p.steps.splice(p.steps.length - 2, 1); // small variation between learners
      if (k % 4 === 2) { const d = 5; p.init[0] -= d; p.init[p.init.length - 1] += d; }
      const a = await simulate(u.id, 'brewly', p, { startAt: now - (3 * DAY) + k * 3.1e6, classroomId: cls.id, stepMs: 70000 + k * 4000 });
      put('attempts', a); applyCase(u, a, getCase('brewly'));
    } else if (k === 14) { // one learner mid-investigation, so "in progress" is visible
      const a = await simulate(u.id, 'brewly', { ...ARCHETYPES.brewly.hoarder, steps: ARCHETYPES.brewly.hoarder.steps.slice(0, 3) }, { startAt: now - 5.4e6, classroomId: cls.id, stopBeforeRec: true }); a.seeded = true; put('attempts', a);
    }
    k++;
  }

  // --- Demo learner
  const me = newUser({ id: 'u_demo', name: 'Aanya Kapoor', university: 'Christ University', demo: true });
  me.classrooms.push(cls.id); me.following = ['u_seed3', 'u_seed9', 'u_seed14', 'u_seed21', 'u_cls0', 'u_cls3']; put('users', me);
  cls.members.push({ userId: me.id, team: 'Team Sabarmati' }); put('classrooms', cls);
  const a1 = await simulate(me.id, 'northstar', ARCHETYPES.northstar.ratesfirst, { startAt: now - 12 * DAY }); put('attempts', a1); applyCase(me, a1, getCase('northstar'));
  const a2 = await simulate(me.id, 'cloudaxis', ARCHETYPES.cloudaxis.solid, { startAt: now - 9 * DAY }); put('attempts', a2); applyCase(me, a2, getCase('cloudaxis'));
  const games = [['margin', 82], ['daily', 70], ['issue-tree', 64], ['daily', 85], ['margin', 91], ['daily', 55], ['duel', 61], ['daily', 78]];
  games.forEach(([mode, score], i) => { const t = now - (6 - Math.floor(i * 0.7)) * DAY - 3600000; const res = applyGame(me, mode, { score, xp: 80, skills: mode === 'margin' ? ['quant', 'evidence'] : mode === 'issue-tree' ? ['structuring', 'hypothesis'] : ['calibration', 'hypothesis'], label: { margin: 'Margin Detective', daily: 'Daily Diagnostic', 'issue-tree': 'Issue Tree Arena', duel: 'Hypothesis Duel' }[mode] }, t); put('games', { id: `g_seed${i}`, userId: me.id, mode, score, earned: res.earned, t, seeded: true }); });
  // A deliberately uneven profile: strong on numbers, weaker on evidence selection and calibration.
  Object.assign(me.skills, { structuring: 67, hypothesis: 61, evidence: 51, quant: 74, calibration: 49, synthesis: 58 });
  me.skillHistory = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: now - (30 - i * 4.5) * DAY, source: 'seed', skills: Object.fromEntries(SKILLS.map((s) => [s.id, Math.round(me.skills[s.id] - (6 - i) * (s.id === 'quant' ? 4.5 : s.id === 'calibration' ? 2 : 3.2) + ((i * 7 + s.id.length) % 3))])) }));
  if (me.xp < 2740) addXp(me, 2740 - me.xp, 'seed', 'Earlier demo activity (seeded)', null, now - 20 * DAY);
  me.streak = { current: 6, best: 9, lastDay: dayKey(now - DAY) };
  me.abandons = [];
  const { rankStatus } = await import('./engine/progression.js');
  // re-issue certificates for the final seeded state
  const st = rankStatus(me); me.rank = st.rank.id;
  const crypto = await import('node:crypto');
  for (let i = 1; i <= st.index; i++) if (!me.certificates.some((c) => c.rank === RANKS[i].id)) {
    const t = now - (18 - i * 6) * DAY; const code = 'CB-' + crypto.createHash('sha256').update(`${me.id}:${RANKS[i].id}`).digest('hex').slice(0, 10).toUpperCase().replace(/(.{5})/, '$1-');
    put('certificates', { id: code, userId: me.id, name: me.name, rank: RANKS[i].id, rankName: RANKS[i].name, issuedAt: t, skills: { ...me.skills }, cases: 2, demo: true }); me.certificates.push({ id: code, rank: RANKS[i].id, issuedAt: t });
  }
  put('users', me);
  put('challenges', { id: 'ch_seed1', fromUserId: 'u_seed9', toUserId: me.id, caseId: 'brewly', bar: 81, createdAt: now - 2 * DAY, note: 'Beat my Brewly score.' });
  db.meta.seededAt = now; flush();
  return true;
}
export const isSeeded = () => Boolean(load().meta.seededAt);
export const counts = () => ({ users: all('users').length, attempts: all('attempts').length });
