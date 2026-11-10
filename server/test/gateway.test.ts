import { beforeEach, describe, expect, it } from 'vitest';

import { signInitData, verifyInitData } from '../src/auth.js';
import { CodeService, GatewayError, type Messenger } from '../src/codes.js';
import { openDb } from '../src/db.js';
import { buildHttp } from '../src/http.js';
import { Store, type Project } from '../src/store.js';

const TOKEN = '123456:TEST-token-for-unit-tests-only-xxxxxxxx';

class FakeMessenger implements Messenger {
  sent: Array<{ chatId: number; html: string; code: string }> = [];
  reachable = true;
  async sendCode(chatId: number, html: string, code: string): Promise<boolean> {
    if (!this.reachable) return false;
    this.sent.push({ chatId, html, code });
    return true;
  }
}

let store: Store;
let messenger: FakeMessenger;
let codes: CodeService;
let project: Project;
let apiKey: string;

beforeEach(() => {
  store = new Store(openDb(':memory:'));
  messenger = new FakeMessenger();
  codes = new CodeService(store, messenger, () => 'test_bot');
  ({ project, apiKey } = store.createProject('YUMS Taxi', { codeLength: 6, ttlSec: 300 }));
});

const link = (tgId = 1001, phone = '+998901234567') => store.linkContact({ tgId, phone, firstName: 'Ali', lang: 'uz' });

describe('kod yetkazish', () => {
  it('ulanmagan raqam: WAITING va bot havolasi, raqam ulangach kod yetadi', async () => {
    const r = await codes.request(project, { phone: '+998 90 123-45-67', code: '4821', mode: 'SEND' });
    expect(r.status).toBe('WAITING');
    expect(r.link).toMatch(/^https:\/\/t\.me\/test_bot\?start=[\w-]+$/);
    expect(messenger.sent).toHaveLength(0);

    const token = r.link!.split('start=')[1];
    expect(codes.inspectToken(token)?.expired).toBe(false);

    const sent = await codes.deliverWaiting(link());
    expect(sent).toBe(1);
    expect(messenger.sent[0]).toMatchObject({ chatId: 1001, code: '4821' });
    expect(messenger.sent[0].html).toContain('YUMS Taxi');
    expect(messenger.sent[0].html).toContain('<code>4821</code>');
    expect(codes.status(project, r.id).status).toBe('SENT');
    expect(codes.inspectToken(token)?.expired).toBe(true);
  });

  it('ulangan raqam: kod darhol yuboriladi', async () => {
    link();
    const r = await codes.request(project, { phone: '998901234567', code: 'AB12', mode: 'SEND' });
    expect(r).toMatchObject({ status: 'SENT', expiresInSec: 300 });
    expect(r.link).toBeUndefined();
    expect(messenger.sent).toHaveLength(1);
  });

  it('foydalanuvchi botni to‘xtatgan bo‘lsa — havola qaytadi', async () => {
    link();
    messenger.reachable = false;
    const r = await codes.request(project, { phone: '+998901234567', code: '1111', mode: 'SEND' });
    expect(r.status).toBe('WAITING');
    expect(r.link).toBeDefined();
  });

  it('loyiha shabloni ishlatiladi va HTML xavfsiz', async () => {
    const custom = store.updateProject(project.id, { template: '<b>{project}</b>: {code} ({minutes} daq)', name: 'A<b>' })!;
    link();
    await codes.request(custom, { phone: '+998901234567', code: '9999', mode: 'SEND' });
    expect(messenger.sent[0].html).toBe('<b>A&lt;b&gt;</b>: <code>9999</code> (5 daq)');
  });

  it('noto‘g‘ri kirish ma’lumotlari rad etiladi', async () => {
    await expect(codes.request(project, { phone: '12', code: '1234', mode: 'SEND' })).rejects.toMatchObject({ code: 'PHONE_INVALID' });
    await expect(codes.request(project, { phone: '+998901234567', code: '12 34', mode: 'SEND' })).rejects.toMatchObject({ code: 'CODE_INVALID' });
    const off = store.updateProject(project.id, { active: false })!;
    await expect(codes.request(off, { phone: '+998901234567', code: '1234', mode: 'SEND' })).rejects.toMatchObject({ code: 'PROJECT_DISABLED' });
  });

  it('bloklangan raqamga yuborilmaydi', async () => {
    link();
    store.setContactBlocked(1001, true);
    await expect(codes.request(project, { phone: '+998901234567', code: '1234', mode: 'SEND' })).rejects.toMatchObject({ status: 403, code: 'PHONE_BLOCKED' });
    expect(messenger.sent).toHaveLength(0);
  });

  it('10 daqiqada 5 tadan ortiq so‘rov — 429', async () => {
    for (let i = 0; i < 5; i++) await codes.request(project, { phone: '+998901234567', code: '1234', mode: 'SEND' });
    const err = await codes.request(project, { phone: '+998901234567', code: '1234', mode: 'SEND' }).catch(e => e as GatewayError);
    expect(err).toBeInstanceOf(GatewayError);
    expect((err as GatewayError).status).toBe(429);
  });

  it('raqam boshqa Telegram akkauntga o‘tsa — eski bog‘lanish o‘chadi', () => {
    link(1001);
    link(2002);
    expect(store.contactByTg(1001)).toBeUndefined();
    expect(store.contactByPhone('+998901234567')?.tgId).toBe(2002);
  });
});

describe('shlyuz yaratadigan kod (VERIFY)', () => {
  it('kod yaratiladi, tekshiriladi, qayta ishlatib bo‘lmaydi', async () => {
    link();
    const r = await codes.request(project, { phone: '+998901234567', mode: 'VERIFY' });
    const code = messenger.sent[0].code;
    expect(code).toMatch(/^\d{6}$/);

    expect(codes.check(project, { id: r.id, code: code === '000000' ? '111111' : '000000' })).toEqual({ valid: false, attemptsLeft: 4 });
    expect(codes.check(project, { phone: '+998901234567', code })).toMatchObject({ valid: true });
    expect(() => codes.check(project, { id: r.id, code })).toThrow(expect.objectContaining({ code: 'ALREADY_USED' }));
  });

  it('5 ta xato urinishdan keyin bloklanadi', async () => {
    link();
    const r = await codes.request(project, { phone: '+998901234567', mode: 'VERIFY' });
    const wrong = messenger.sent[0].code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) codes.check(project, { id: r.id, code: wrong });
    expect(() => codes.check(project, { id: r.id, code: messenger.sent[0].code })).toThrow(expect.objectContaining({ code: 'TOO_MANY_ATTEMPTS' }));
  });

  it('boshqa loyiha kodini tekshira olmaydi', async () => {
    link();
    const r = await codes.request(project, { phone: '+998901234567', mode: 'VERIFY' });
    const other = store.createProject('Boshqa').project;
    expect(() => codes.check(other, { id: r.id, code: messenger.sent[0].code })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('muddati o‘tgan kod yopiladi va bazadan o‘chiriladi', async () => {
    const r = await codes.request(project, { phone: '+998901234567', mode: 'VERIFY', ttlSec: 30 });
    store.db.prepare('UPDATE deliveries SET expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), r.id);
    expect(store.sweep()).toBe(1);
    const d = store.deliveryById(r.id)!;
    expect(d.status).toBe('EXPIRED');
    expect(d.code).toBe('');
    expect(await codes.deliverWaiting(link())).toBe(0);
  });
});

describe('Telegram Mini App imzosi', () => {
  const fields = () => ({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Admin' }), query_id: 'AAH' });

  it('to‘g‘ri imzo qabul qilinadi', () => {
    expect(verifyInitData(signInitData(fields(), TOKEN), TOKEN)).toEqual({ id: 42, firstName: 'Admin', lastName: undefined });
  });

  it('o‘zgartirilgan, boshqa token bilan yoki eskirgan imzo rad etiladi', () => {
    const tampered = signInitData(fields(), TOKEN).replace('%22id%22%3A42', '%22id%22%3A43');
    expect(verifyInitData(tampered, TOKEN)).toBeNull();
    expect(verifyInitData(signInitData(fields(), '999:other-token-xxxxxxxxxxxxxxxxxxxxxxxxx'), TOKEN)).toBeNull();
    expect(verifyInitData(signInitData({ ...fields(), auth_date: '1000' }, TOKEN), TOKEN)).toBeNull();
  });
});

describe('HTTP', () => {
  const app = () => buildHttp({ store, codes, botToken: TOKEN, botUsername: () => 'test_bot', webDir: '/nonexistent' });

  it('loyiha API kalit talab qiladi', async () => {
    const a = app();
    const no = await a.inject({ method: 'POST', url: '/v1/send', payload: { phone: '+998901234567', code: '1234' } });
    expect(no.statusCode).toBe(401);
    const bad = await a.inject({ method: 'POST', url: '/v1/send', headers: { authorization: 'Bearer tcg_wrong' }, payload: { phone: '+998901234567', code: '1234' } });
    expect(bad.statusCode).toBe(401);

    const ok = await a.inject({ method: 'POST', url: '/v1/send', headers: { authorization: `Bearer ${apiKey}` }, payload: { phone: '+998901234567', code: '1234' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data).toMatchObject({ status: 'WAITING', link: expect.stringContaining('t.me/test_bot?start=') });

    const status = await a.inject({ method: 'GET', url: `/v1/status/${ok.json().data.id}`, headers: { authorization: `Bearer ${apiKey}` } });
    expect(status.json().data.status).toBe('WAITING');
  });

  it('noto‘g‘ri so‘rov tanasi — 400', async () => {
    const r = await app().inject({ method: 'POST', url: '/v1/send', headers: { authorization: `Bearer ${apiKey}` }, payload: { phone: '+998901234567' } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('BAD_REQUEST');
  });

  it('verify va check HTTP orqali', async () => {
    link();
    const a = app();
    const auth = { authorization: `Bearer ${apiKey}` };
    const v = await a.inject({ method: 'POST', url: '/v1/verify', headers: auth, payload: { phone: '+998901234567' } });
    expect(v.json().data.status).toBe('SENT');
    const c = await a.inject({ method: 'POST', url: '/v1/verify/check', headers: auth, payload: { id: v.json().data.id, code: messenger.sent[0].code } });
    expect(c.json().data.valid).toBe(true);
  });

  it('admin API: sessiyasiz 401, Mini App orqali kirish, oddiy foydalanuvchi 403', async () => {
    const a = app();
    expect((await a.inject({ method: 'GET', url: '/admin/api/projects' })).statusCode).toBe(401);

    const initData = signInitData({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Admin' }) }, TOKEN);
    expect((await a.inject({ method: 'POST', url: '/admin/api/auth/webapp', payload: { initData } })).statusCode).toBe(403);

    store.addAdmin(42, 'Admin');
    const login = await a.inject({ method: 'POST', url: '/admin/api/auth/webapp', payload: { initData } });
    const token = login.json().data.token as string;
    const me = await a.inject({ method: 'GET', url: '/admin/api/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.json().data).toMatchObject({ tgId: 42, bot: 'test_bot', name: 'Admin' });
  });

  it('brauzer havolasi bir martalik', async () => {
    store.addAdmin(42);
    const linkToken = store.createLoginLink(42);
    const a = app();
    expect((await a.inject({ method: 'POST', url: '/admin/api/auth/link', payload: { token: linkToken } })).statusCode).toBe(200);
    expect((await a.inject({ method: 'POST', url: '/admin/api/auth/link', payload: { token: linkToken } })).statusCode).toBe(401);
  });

  it('admin loyiha yaratadi, kalit ishlaydi; yangilangach eskisi ishlamaydi', async () => {
    store.addAdmin(42);
    const auth = { authorization: `Bearer ${store.createSession(42)}` };
    const a = app();
    const created = await a.inject({ method: 'POST', url: '/admin/api/projects', headers: auth, payload: { name: 'Do‘kon', codeLength: 4, ttlSec: 120 } });
    const { project: p, apiKey: key } = created.json().data as { project: Project; apiKey: string };
    expect(key).toMatch(/^tcg_/);
    expect(p).toMatchObject({ name: 'Do‘kon', codeLength: 4, ttlSec: 120, active: true });
    expect(JSON.stringify((await a.inject({ method: 'GET', url: '/admin/api/projects', headers: auth })).json())).not.toContain(key);

    const rotated = await a.inject({ method: 'POST', url: `/admin/api/projects/${p.id}/rotate-key`, headers: auth });
    const send = (k: string) => a.inject({ method: 'POST', url: '/v1/send', headers: { authorization: `Bearer ${k}` }, payload: { phone: '+998901234567', code: '1234' } });
    expect((await send(key)).statusCode).toBe(401);
    expect((await send(rotated.json().data.apiKey)).statusCode).toBe(200);
  });

  it('kodlar tarixida raqam yashirilgan va kodning o‘zi yo‘q', async () => {
    store.addAdmin(42);
    await codes.request(project, { phone: '+998901234567', code: '58213', mode: 'SEND' });
    const r = await app().inject({ method: 'GET', url: '/admin/api/deliveries', headers: { authorization: `Bearer ${store.createSession(42)}` } });
    const body = r.json();
    expect(body.meta.total).toBe(1);
    expect(body.data[0]).toMatchObject({ project: 'YUMS Taxi', phone: '+99890•••67', status: 'WAITING' });
    expect(JSON.stringify(body)).not.toContain('58213');
  });

  it('admin o‘zini o‘chira olmaydi', async () => {
    store.addAdmin(42);
    const r = await app().inject({ method: 'DELETE', url: '/admin/api/admins/42', headers: { authorization: `Bearer ${store.createSession(42)}` } });
    expect(r.statusCode).toBe(409);
  });
});
