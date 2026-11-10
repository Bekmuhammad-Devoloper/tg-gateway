// Muhit o'zgaruvchilari. Bot tokeni va boshqa sirlar faqat .env (yoki server muhitida) turadi.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** .env faylini (bo'lsa) process.env ga yuklaydi; mavjud o'zgaruvchilar ustidan yozilmaydi */
export function loadDotEnv(path = resolve(process.cwd(), '.env')): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

export interface Config {
  botToken: string;
  port: number;
  /** Tashqaridan ochiladigan manzil (https bo'lsa admin panel Telegram ichida Mini App bo'lib ochiladi) */
  publicUrl: string;
  databasePath: string;
  /** Doimiy adminlar (Telegram user id), vergul bilan */
  adminIds: number[];
  /** polling — oddiy server/kompyuterda; webhook — https PUBLIC_URL bilan */
  botMode: 'polling' | 'webhook';
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const botToken = env.BOT_TOKEN?.trim() ?? '';
  if (!/^\d+:[\w-]{30,}$/.test(botToken)) throw new Error('BOT_TOKEN topilmadi yoki noto‘g‘ri (.env faylini tekshiring)');
  const port = Number(env.PORT ?? 8080);
  const publicUrl = (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
  return {
    botToken,
    port,
    publicUrl,
    databasePath: env.DATABASE_PATH ?? resolve(process.cwd(), 'data/gateway.db'),
    adminIds: (env.ADMIN_IDS ?? '').split(',').map(s => Number(s.trim())).filter(n => Number.isSafeInteger(n) && n > 0),
    botMode: env.BOT_MODE === 'webhook' ? 'webhook' : 'polling',
  };
}
