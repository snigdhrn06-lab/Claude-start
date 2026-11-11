// Local persistence layer: one JSON document, atomic writes, collection helpers.
// Swap this module for a SQL/Postgres repository to migrate — callers only use the functions below.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.CB_DATA_DIR || path.join(here, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');
const EMPTY = () => ({ meta: { version: 1, seededAt: null }, users: {}, sessions: {}, attempts: {}, games: {}, classrooms: {}, certificates: {}, challenges: {} });

let db = null; let timer = null;
export function load() {
  if (db) return db;
  try { db = { ...EMPTY(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { db = EMPTY(); }
  return db;
}
export function flush() {
  if (!db) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
export function save() { clearTimeout(timer); timer = setTimeout(flush, 150); }
export function reset() { db = EMPTY(); flush(); return db; }
export const uid = (p = '') => p + crypto.randomBytes(6).toString('hex');
export const col = (name) => load()[name];
export const all = (name) => Object.values(load()[name]);
export function put(name, obj) { load()[name][obj.id] = obj; save(); return obj; }
export function del(name, id) { delete load()[name][id]; save(); }
process.on('exit', () => { clearTimeout(timer); try { flush(); } catch {} });
