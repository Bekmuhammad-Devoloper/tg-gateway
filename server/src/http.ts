// HTTP: loyihalar uchun API (/v1, API kalit bilan), admin panel API (/admin/api, sessiya bilan) va panelning o'zi.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';

import { verifyInitData } from './auth.js';
import { GatewayError, type CodeService } from './codes.js';
import type { Project, Store } from './store.js';
import { maskPhone } from './util.js';

export interface HttpDeps {
  store: Store;
  codes: CodeService;
  botToken: string;
  botUsername: () => string;
  /** Telegram profil rasmi (JPEG) — admin yoki botning o'zi; rasm bo'lmasa null */
  profilePhoto?: (who: 'bot' | number) => Promise<Buffer | null>;
  /** Admin panelning yig'ilgan fayllari (vite build) */
  webDir?: string;
  logger?: boolean;
}

const bearer = (req: FastifyRequest): string => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();

const sendCodeBody = z.object({
  phone: z.string().min(5).max(32),
  code: z.string().min(3).max(12),
  ttlSec: z.number().int().min(30).max(3600).optional(),
  lang: z.enum(['uz', 'ru', 'en']).optional(),
});
const verifyBody = z.object({
  phone: z.string().min(5).max(32),
  ttlSec: z.number().int().min(30).max(3600).optional(),
  lang: z.enum(['uz', 'ru', 'en']).optional(),
});
const checkBody = z.object({ id: z.string().optional(), phone: z.string().optional(), code: z.string().min(3).max(12) }).refine(b => b.id || b.phone, 'id yoki phone kerak');
const projectBody = z.object({
  name: z.string().trim().min(2).max(60),
  template: z.string().max(1000).optional(),
  codeLength: z.number().int().min(4).max(8).optional(),
  ttlSec: z.number().int().min(30).max(3600).optional(),
  active: z.boolean().optional(),
});

export function buildHttp(deps: HttpDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 64 * 1024, trustProxy: true });
  const { store, codes } = deps;

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof GatewayError) return reply.status(error.status).send({ ok: false, error: { code: error.code, message: error.message, details: error.details } });
    if (error instanceof z.ZodError) return reply.status(400).send({ ok: false, error: { code: 'BAD_REQUEST', message: error.issues.map(i => i.message).join('; ') } });
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send({ ok: false, error: { code: status === 500 ? 'INTERNAL' : 'BAD_REQUEST', message: status === 500 ? 'Server xatosi' : (error as Error).message } });
  });

  app.get('/health', async () => ({ ok: true, bot: deps.botUsername() }));

  // ---- loyihalar API -----------------------------------------------------------------------

  const project = (req: FastifyRequest): Project => {
    const key = bearer(req);
    const p = key ? store.findProjectByKey(key) : undefined;
    if (!p) throw new GatewayError(401, 'UNAUTHORIZED', 'API kalit noto‘g‘ri');
    return p;
  };

  /** Loyiha yaratgan kodni Telegram orqali yetkazish */
  app.post('/v1/send', async req => {
    const body = sendCodeBody.parse(req.body);
    return { ok: true, data: await codes.request(project(req), { ...body, mode: 'SEND' }) };
  });

  /** Kodni shlyuz yaratadi va yetkazadi */
  app.post('/v1/verify', async req => {
    const body = verifyBody.parse(req.body);
    return { ok: true, data: await codes.request(project(req), { ...body, mode: 'VERIFY' }) };
  });

  app.post('/v1/verify/check', async req => {
    const body = checkBody.parse(req.body);
    return { ok: true, data: codes.check(project(req), body) };
  });

  app.get<{ Params: { id: string } }>('/v1/status/:id', async req => ({ ok: true, data: codes.status(project(req), req.params.id) }));

  // ---- admin panel API ---------------------------------------------------------------------

  const admin = (req: FastifyRequest): number => {
    const tgId = store.sessionUser(bearer(req));
    if (!tgId || !store.isAdmin(tgId)) throw new GatewayError(401, 'UNAUTHORIZED', 'Kirish kerak');
    return tgId;
  };

  app.post('/admin/api/auth/webapp', async req => {
    const { initData } = z.object({ initData: z.string().min(10) }).parse(req.body);
    const user = verifyInitData(initData, deps.botToken);
    if (!user) throw new GatewayError(401, 'UNAUTHORIZED', 'Telegram imzosi noto‘g‘ri');
    if (!store.isAdmin(user.id)) throw new GatewayError(403, 'NOT_ADMIN', 'Siz administrator emassiz');
    return { ok: true, data: { token: store.createSession(user.id) } };
  });

  app.post('/admin/api/auth/link', async req => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    const tgId = store.consumeLoginLink(token);
    if (!tgId || !store.isAdmin(tgId)) throw new GatewayError(401, 'UNAUTHORIZED', 'Havola eskirgan — botda /admin ni qayta bosing');
    return { ok: true, data: { token: store.createSession(tgId) } };
  });

  app.post('/admin/api/auth/logout', async req => {
    store.deleteSession(bearer(req));
    return { ok: true };
  });

  app.get('/admin/api/me', async req => {
    const tgId = admin(req);
    return { ok: true, data: { tgId, bot: deps.botUsername(), name: store.listAdmins().find(a => a.tgId === tgId)?.name ?? '' } };
  });

  /** Panelda ko'rsatiladigan profil rasmi: o'ziniki (me) yoki botniki (bot) */
  app.get<{ Params: { who: string } }>('/admin/api/photo/:who', async (req, reply) => {
    const tgId = admin(req);
    const who = req.params.who === 'bot' ? 'bot' : req.params.who === 'me' ? tgId : null;
    if (who === null) throw new GatewayError(404, 'NOT_FOUND', 'Topilmadi');
    const photo = deps.profilePhoto ? await deps.profilePhoto(who) : null;
    if (!photo) throw new GatewayError(404, 'NO_PHOTO', 'Rasm yo‘q');
    return reply.header('content-type', 'image/jpeg').header('cache-control', 'private, max-age=3600').send(photo);
  });

  app.get('/admin/api/stats', async req => {
    admin(req);
    return { ok: true, data: store.stats() };
  });

  app.get('/admin/api/projects', async req => {
    admin(req);
    const activity = store.projectActivity();
    const none = { today: 0, week: 0, delivered: 0 };
    return { ok: true, data: store.listProjects().map(p => ({ ...p, activity: activity.get(p.id) ?? none })) };
  });

  app.post('/admin/api/projects', async req => {
    admin(req);
    const body = projectBody.parse(req.body);
    const { project: p, apiKey } = store.createProject(body.name, body);
    return { ok: true, data: { project: p, apiKey } };
  });

  app.patch<{ Params: { id: string } }>('/admin/api/projects/:id', async req => {
    admin(req);
    const body = projectBody.partial().parse(req.body);
    const p = store.updateProject(req.params.id, body);
    if (!p) throw new GatewayError(404, 'NOT_FOUND', 'Loyiha topilmadi');
    return { ok: true, data: p };
  });

  app.post<{ Params: { id: string } }>('/admin/api/projects/:id/rotate-key', async req => {
    admin(req);
    const apiKey = store.rotateKey(req.params.id);
    if (!apiKey) throw new GatewayError(404, 'NOT_FOUND', 'Loyiha topilmadi');
    return { ok: true, data: { apiKey } };
  });

  app.delete<{ Params: { id: string } }>('/admin/api/projects/:id', async req => {
    admin(req);
    if (!store.deleteProject(req.params.id)) throw new GatewayError(404, 'NOT_FOUND', 'Loyiha topilmadi');
    return { ok: true };
  });

  /** Panel orqali sinov kodi: loyihaning shabloni bilan istalgan ulangan raqamga */
  app.post<{ Params: { id: string } }>('/admin/api/projects/:id/test', async req => {
    admin(req);
    const p = store.getProject(req.params.id);
    if (!p) throw new GatewayError(404, 'NOT_FOUND', 'Loyiha topilmadi');
    const { phone } = z.object({ phone: z.string().min(5) }).parse(req.body);
    return { ok: true, data: await codes.request(p, { phone, mode: 'VERIFY' }) };
  });

  app.get<{ Querystring: { search?: string; page?: string } }>('/admin/api/contacts', async req => {
    admin(req);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const { items, total } = store.listContacts((req.query.search ?? '').trim(), 50, (page - 1) * 50);
    return { ok: true, data: items, meta: { page, total } };
  });

  app.patch<{ Params: { tgId: string } }>('/admin/api/contacts/:tgId', async req => {
    admin(req);
    const { blocked } = z.object({ blocked: z.boolean() }).parse(req.body);
    if (!store.setContactBlocked(Number(req.params.tgId), blocked)) throw new GatewayError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    return { ok: true };
  });

  app.delete<{ Params: { tgId: string } }>('/admin/api/contacts/:tgId', async req => {
    admin(req);
    if (!store.removeContact(Number(req.params.tgId))) throw new GatewayError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi');
    return { ok: true };
  });

  app.get<{ Querystring: { projectId?: string; status?: string; page?: string } }>('/admin/api/deliveries', async req => {
    admin(req);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const { items, total } = store.listDeliveries({ projectId: req.query.projectId || undefined, status: req.query.status || undefined, limit: 50, offset: (page - 1) * 50 });
    const names = new Map(store.listProjects().map(p => [p.id, p.name]));
    return {
      ok: true,
      // Kodning o'zi panelda ko'rsatilmaydi
      data: items.map(d => ({ id: d.id, project: names.get(d.projectId) ?? '—', phone: maskPhone(d.phone), mode: d.mode, status: d.status, attempts: d.attempts, createdAt: d.createdAt, sentAt: d.sentAt, expiresAt: d.expiresAt })),
      meta: { page, total },
    };
  });

  app.get('/admin/api/settings', async req => {
    admin(req);
    return { ok: true, data: { settings: store.allSettings(), admins: store.listAdmins() } };
  });

  app.put('/admin/api/settings', async req => {
    admin(req);
    const body = z.record(z.enum(['welcome.uz', 'welcome.ru', 'welcome.en']), z.string().max(2000)).parse(req.body);
    for (const [k, v] of Object.entries(body)) store.setSetting(k, v ?? '');
    return { ok: true, data: store.allSettings() };
  });

  app.post('/admin/api/admins', async req => {
    admin(req);
    const { tgId, name } = z.object({ tgId: z.number().int().positive(), name: z.string().max(60).optional() }).parse(req.body);
    store.addAdmin(tgId, name ?? '');
    return { ok: true, data: store.listAdmins() };
  });

  app.delete<{ Params: { tgId: string } }>('/admin/api/admins/:tgId', async req => {
    const me = admin(req);
    const tgId = Number(req.params.tgId);
    if (tgId === me) throw new GatewayError(409, 'SELF', 'O‘zingizni o‘chira olmaysiz');
    store.removeAdmin(tgId);
    return { ok: true, data: store.listAdmins() };
  });

  // ---- admin panelning o'zi ----------------------------------------------------------------

  const webDir = deps.webDir ?? resolve(process.cwd(), 'dist/web');
  if (existsSync(webDir)) {
    void app.register(fastifyStatic, { root: webDir, prefix: '/' });
    app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
      if (req.url.startsWith('/v1') || req.url.startsWith('/admin/api')) return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
      return reply.sendFile('index.html');
    });
  }

  return app;
}
