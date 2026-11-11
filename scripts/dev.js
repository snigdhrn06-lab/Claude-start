// Runs the API server and the Vite dev server together.
import { spawn } from 'node:child_process';
const run = (cmd, args) => { const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' }); p.on('exit', (c) => { if (c) process.exit(c); }); return p; };
const procs = [run('node', ['server/index.js']), run('npx', ['vite'])];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
