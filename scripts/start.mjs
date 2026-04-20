#!/usr/bin/env node
/*
 * Railway/Docker start script.
 *
 * The previous `prisma db push && seed && next start` chain blocked the
 * healthcheck during the DB steps. If anything in that chain errored, Next
 * never started and Railway reported "service unavailable" indefinitely.
 *
 * This script starts Next immediately (so /api/health responds as soon as the
 * server binds) and runs the DB sync + seed in parallel. Everything is logged
 * loudly so the Railway Deploy Logs tab shows what's happening.
 */

import { spawn } from 'node:child_process';

const prefix = (tag) => (line) => process.stdout.write(`[${tag}] ${line}`);

function log(msg) {
  console.log(`[boot] ${msg}`);
}

log('starting heruni-dict');
log(`NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`);
log(`PORT=${process.env.PORT ?? '(unset, Next will default to 3000)'}`);
log(`DATABASE_URL=${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, '://***@').slice(0, 80) + '…' : '(MISSING — set it in Railway Variables to ${{ Postgres.DATABASE_URL }})'}`);
log(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL ?? '(unset)'}`);

// 1. Start Next.js immediately — /api/health will respond as soon as this binds.
log('spawning: next start');
const next = spawn('npx', ['next', 'start'], {
  stdio: 'inherit',
  env: process.env
});
next.on('exit', (code, signal) => {
  log(`next exited (code=${code}, signal=${signal})`);
  process.exit(code ?? 1);
});

// 2. In parallel, sync the DB schema and seed.
if (!process.env.DATABASE_URL) {
  log('skipping DB sync — DATABASE_URL not set.');
} else {
  log('spawning (background): prisma db push && tsx prisma/seed.ts');
  const db = spawn(
    'sh',
    [
      '-c',
      'npx prisma db push --accept-data-loss --skip-generate && npx tsx prisma/seed.ts'
    ],
    { stdio: 'inherit', env: process.env }
  );
  db.on('exit', (code) => {
    if (code === 0) log('DB sync + seed finished OK.');
    else log(`DB sync exited with code ${code} — Next is still running; inspect logs above.`);
  });
}

// 3. Clean shutdown on SIGTERM (Railway stops containers with SIGTERM).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log(`received ${sig}, forwarding to next`);
    next.kill(sig);
  });
}
