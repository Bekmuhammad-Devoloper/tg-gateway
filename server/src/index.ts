// Ishga tushirish: baza → bot → HTTP. Bot long polling (oddiy server) yoki webhook (https) rejimida.
import { webhookCallback } from 'grammy';

import { botMessenger, createBot, setAdminCommands, setAdminMenu, setPublicCommands } from './bot.js';
import { CodeService } from './codes.js';
import { loadDotEnv, readConfig } from './config.js';
import { openDb } from './db.js';
import { buildHttp } from './http.js';
import { Store } from './store.js';
import { randomCode, sha256 } from './util.js';

loadDotEnv();
const config = readConfig();
const log = (msg: string): void => console.log(`[${new Date().toISOString()}] ${msg}`);

const db = openDb(config.databasePath);
const store = new Store(db);
for (const id of config.adminIds) if (!store.isAdmin(id)) store.addAdmin(id);

// Adminlar yo'q — birinchi admin botga «/claim <kod>» yozib o'zini belgilaydi
const claim = { code: store.countAdmins() === 0 ? randomCode(8) : null };

let codes: CodeService | undefined;
const bot = createBot(config.botToken, { store, codes: () => codes!, publicUrl: config.publicUrl, claim, log });
await bot.init();
const username = bot.botInfo.username;
codes = new CodeService(store, botMessenger(bot, log), () => username);

const app = buildHttp({ store, codes, botToken: config.botToken, botUsername: () => username });

const webhookPath = `/telegram/${sha256(config.botToken).slice(0, 24)}`;
const webhookSecret = sha256(`secret:${config.botToken}`).slice(0, 48);
if (config.botMode === 'webhook') {
  app.post(webhookPath, webhookCallback(bot, 'fastify', { secretToken: webhookSecret }));
}

await app.listen({ port: config.port, host: '0.0.0.0' });
log(`HTTP: ${config.publicUrl} (port ${config.port})`);

await setPublicCommands(bot).catch(e => log(`setMyCommands: ${(e as Error).message}`));
for (const a of store.listAdmins()) {
  await setAdminCommands(bot, a.tgId, 'uz').catch(() => {});
  await setAdminMenu(bot, a.tgId, config.publicUrl, 'uz').catch(() => {});
}

if (config.botMode === 'webhook') {
  await bot.api.setWebhook(`${config.publicUrl}${webhookPath}`, { secret_token: webhookSecret, allowed_updates: ['message'] });
  log(`Bot @${username}: webhook`);
} else {
  void bot.start({ allowed_updates: ['message'], onStart: () => log(`Bot @${username}: long polling`) });
}

if (claim.code) {
  log('==================================================================');
  log(`Adminlar hali yo'q. Telegram'da @${username} ga yozing:  /claim ${claim.code}`);
  log('==================================================================');
}

const sweeper = setInterval(() => {
  const n = store.sweep();
  if (n) log(`expired: ${n}`);
}, 60_000);

const shutdown = async (signal: string): Promise<void> => {
  log(`${signal}: to'xtatilmoqda`);
  clearInterval(sweeper);
  if (config.botMode === 'polling') await bot.stop().catch(() => {});
  await app.close().catch(() => {});
  db.close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
