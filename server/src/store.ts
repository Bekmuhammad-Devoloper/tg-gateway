// Ma'lumotlar bilan ishlash: loyihalar, kontaktlar (telefon ↔ Telegram), kodlar, adminlar, sozlamalar, sessiyalar.
import type { Db } from './db.js';
import { inSeconds, nowIso, randomId, randomToken, sha256 } from './util.js';

export type DeliveryStatus = 'WAITING' | 'SENT' | 'EXPIRED' | 'FAILED' | 'USED';
export type DeliveryMode = 'SEND' | 'VERIFY';

export interface Project {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  template: string;
  codeLength: number;
  ttlSec: number;
  createdAt: string;
}

export interface Contact {
  tgId: number;
  phone: string;
  firstName: string;
  username: string | null;
  lang: string;
  blocked: boolean;
  linkedAt: string;
  lastCodeAt: string | null;
}

export interface Delivery {
  id: string;
  projectId: string;
  phone: string;
  code: string;
  mode: DeliveryMode;
  status: DeliveryStatus;
  linkToken: string;
  attempts: number;
  lang: string | null;
  createdAt: string;
  sentAt: string | null;
  expiresAt: string;
}

type Row = Record<string, unknown>;

const toProject = (r: Row): Project => ({
  id: String(r.id),
  name: String(r.name),
  keyPrefix: String(r.key_prefix),
  active: Number(r.active) === 1,
  template: String(r.template),
  codeLength: Number(r.code_length),
  ttlSec: Number(r.ttl_sec),
  createdAt: String(r.created_at),
});

const toContact = (r: Row): Contact => ({
  tgId: Number(r.tg_id),
  phone: String(r.phone),
  firstName: String(r.first_name),
  username: r.username == null ? null : String(r.username),
  lang: String(r.lang),
  blocked: Number(r.blocked) === 1,
  linkedAt: String(r.linked_at),
  lastCodeAt: r.last_code_at == null ? null : String(r.last_code_at),
});

const toDelivery = (r: Row): Delivery => ({
  id: String(r.id),
  projectId: String(r.project_id),
  phone: String(r.phone),
  code: String(r.code),
  mode: String(r.mode) as DeliveryMode,
  status: String(r.status) as DeliveryStatus,
  linkToken: String(r.link_token),
  attempts: Number(r.attempts),
  lang: r.lang == null ? null : String(r.lang),
  createdAt: String(r.created_at),
  sentAt: r.sent_at == null ? null : String(r.sent_at),
  expiresAt: String(r.expires_at),
});

/** Loyiha API kaliti: «tcg_» + tasodifiy satr. Bazada faqat xeshi turadi */
const newApiKey = (): string => `tcg_${randomToken(24)}`;

export class Store {
  constructor(readonly db: Db) {}

  // ---- adminlar ----------------------------------------------------------------------------

  isAdmin(tgId: number): boolean {
    return this.db.prepare('SELECT 1 FROM admins WHERE tg_id = ?').get(tgId) !== undefined;
  }

  countAdmins(): number {
    return Number((this.db.prepare('SELECT COUNT(*) AS n FROM admins').get() as Row).n);
  }

  listAdmins(): Array<{ tgId: number; name: string; addedAt: string }> {
    return (this.db.prepare('SELECT * FROM admins ORDER BY added_at').all() as Row[]).map(r => ({
      tgId: Number(r.tg_id),
      name: String(r.name),
      addedAt: String(r.added_at),
    }));
  }

  addAdmin(tgId: number, name = ''): void {
    this.db
      .prepare('INSERT INTO admins (tg_id, name, added_at) VALUES (?, ?, ?) ON CONFLICT(tg_id) DO UPDATE SET name = excluded.name')
      .run(tgId, name, nowIso());
  }

  removeAdmin(tgId: number): boolean {
    return Number(this.db.prepare('DELETE FROM admins WHERE tg_id = ?').run(tgId).changes) > 0;
  }

  // ---- loyihalar ---------------------------------------------------------------------------

  createProject(name: string, opts: Partial<Pick<Project, 'template' | 'codeLength' | 'ttlSec'>> = {}): { project: Project; apiKey: string } {
    const apiKey = newApiKey();
    const id = randomId();
    this.db
      .prepare('INSERT INTO projects (id, name, key_hash, key_prefix, active, template, code_length, ttl_sec, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)')
      .run(id, name, sha256(apiKey), apiKey.slice(0, 12), opts.template ?? '', opts.codeLength ?? 5, opts.ttlSec ?? 300, nowIso());
    return { project: this.getProject(id)!, apiKey };
  }

  getProject(id: string): Project | undefined {
    const r = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
    return r ? toProject(r) : undefined;
  }

  findProjectByKey(apiKey: string): Project | undefined {
    const r = this.db.prepare('SELECT * FROM projects WHERE key_hash = ?').get(sha256(apiKey)) as Row | undefined;
    return r ? toProject(r) : undefined;
  }

  listProjects(): Project[] {
    return (this.db.prepare('SELECT * FROM projects ORDER BY created_at').all() as Row[]).map(toProject);
  }

  updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'active' | 'template' | 'codeLength' | 'ttlSec'>>): Project | undefined {
    const current = this.getProject(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    this.db
      .prepare('UPDATE projects SET name = ?, active = ?, template = ?, code_length = ?, ttl_sec = ? WHERE id = ?')
      .run(next.name, next.active ? 1 : 0, next.template, next.codeLength, next.ttlSec, id);
    return this.getProject(id);
  }

  /** Yangi kalit: eskisi darhol ishlamay qoladi */
  rotateKey(id: string): string | undefined {
    if (!this.getProject(id)) return undefined;
    const apiKey = newApiKey();
    this.db.prepare('UPDATE projects SET key_hash = ?, key_prefix = ? WHERE id = ?').run(sha256(apiKey), apiKey.slice(0, 12), id);
    return apiKey;
  }

  deleteProject(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes) > 0;
  }

  // ---- kontaktlar (telefon ↔ Telegram) -----------------------------------------------------

  contactByTg(tgId: number): Contact | undefined {
    const r = this.db.prepare('SELECT * FROM contacts WHERE tg_id = ?').get(tgId) as Row | undefined;
    return r ? toContact(r) : undefined;
  }

  contactByPhone(phone: string): Contact | undefined {
    const r = this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone) as Row | undefined;
    return r ? toContact(r) : undefined;
  }

  /**
   * Telegram foydalanuvchisini raqamiga bog'laydi. Raqam boshqa akkauntga bog'langan bo'lsa,
   * u bog'lanish olib tashlanadi (raqam egasi o'zgargan).
   */
  linkContact(c: { tgId: number; phone: string; firstName: string; username?: string | null; lang: string }): Contact {
    this.db.prepare('DELETE FROM contacts WHERE phone = ? AND tg_id <> ?').run(c.phone, c.tgId);
    this.db
      .prepare(
        `INSERT INTO contacts (tg_id, phone, first_name, username, lang, blocked, linked_at) VALUES (?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(tg_id) DO UPDATE SET phone = excluded.phone, first_name = excluded.first_name,
           username = excluded.username, lang = excluded.lang, linked_at = excluded.linked_at`,
      )
      .run(c.tgId, c.phone, c.firstName, c.username ?? null, c.lang, nowIso());
    return this.contactByTg(c.tgId)!;
  }

  setContactBlocked(tgId: number, blocked: boolean): boolean {
    return Number(this.db.prepare('UPDATE contacts SET blocked = ? WHERE tg_id = ?').run(blocked ? 1 : 0, tgId).changes) > 0;
  }

  removeContact(tgId: number): boolean {
    return Number(this.db.prepare('DELETE FROM contacts WHERE tg_id = ?').run(tgId).changes) > 0;
  }

  touchContact(tgId: number): void {
    this.db.prepare('UPDATE contacts SET last_code_at = ? WHERE tg_id = ?').run(nowIso(), tgId);
  }

  listContacts(search: string, limit: number, offset: number): { items: Contact[]; total: number } {
    const like = `%${search.replace(/[%_]/g, '')}%`;
    const where = search ? 'WHERE phone LIKE ? OR first_name LIKE ? OR username LIKE ?' : '';
    const args = search ? [like, like, like] : [];
    const items = (this.db.prepare(`SELECT * FROM contacts ${where} ORDER BY linked_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset) as Row[]).map(toContact);
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM contacts ${where}`).get(...args) as Row).n);
    return { items, total };
  }

  // ---- kodlar ------------------------------------------------------------------------------

  insertDelivery(d: { projectId: string; phone: string; code: string; mode: DeliveryMode; ttlSec: number; lang?: string | null }): Delivery {
    const id = randomId();
    this.db
      .prepare('INSERT INTO deliveries (id, project_id, phone, code, mode, status, link_token, attempts, lang, created_at, expires_at) VALUES (?, ?, ?, ?, ?, \'WAITING\', ?, 0, ?, ?, ?)')
      .run(id, d.projectId, d.phone, d.code, d.mode, randomToken(18), d.lang ?? null, nowIso(), inSeconds(d.ttlSec));
    return this.deliveryById(id)!;
  }

  deliveryById(id: string): Delivery | undefined {
    const r = this.db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id) as Row | undefined;
    return r ? toDelivery(r) : undefined;
  }

  deliveryByToken(token: string): Delivery | undefined {
    const r = this.db.prepare('SELECT * FROM deliveries WHERE link_token = ?').get(token) as Row | undefined;
    return r ? toDelivery(r) : undefined;
  }

  /** Raqam uchun hali yetkazilmagan, muddati o'tmagan kodlar (eskisidan yangisiga) */
  waitingFor(phone: string): Delivery[] {
    return (this.db.prepare("SELECT * FROM deliveries WHERE phone = ? AND status = 'WAITING' AND expires_at > ? ORDER BY created_at").all(phone, nowIso()) as Row[]).map(toDelivery);
  }

  /** Loyihaning shu raqam uchun eng so'nggi tekshiriladigan (VERIFY) kodi */
  latestVerify(projectId: string, phone: string): Delivery | undefined {
    const r = this.db
      .prepare("SELECT * FROM deliveries WHERE project_id = ? AND phone = ? AND mode = 'VERIFY' ORDER BY created_at DESC LIMIT 1")
      .get(projectId, phone) as Row | undefined;
    return r ? toDelivery(r) : undefined;
  }

  setStatus(id: string, status: DeliveryStatus): void {
    const sentAt = status === 'SENT' ? nowIso() : null;
    this.db.prepare('UPDATE deliveries SET status = ?, sent_at = COALESCE(?, sent_at) WHERE id = ?').run(status, sentAt, id);
  }

  addAttempt(id: string): number {
    this.db.prepare('UPDATE deliveries SET attempts = attempts + 1 WHERE id = ?').run(id);
    return this.deliveryById(id)?.attempts ?? 0;
  }

  /** Bir loyiha bir raqamga oxirgi `sinceSec` soniyada nechta kod so'ragan */
  recentCount(projectId: string, phone: string, sinceSec: number): number {
    const since = new Date(Date.now() - sinceSec * 1000).toISOString();
    return Number((this.db.prepare('SELECT COUNT(*) AS n FROM deliveries WHERE project_id = ? AND phone = ? AND created_at > ?').get(projectId, phone, since) as Row).n);
  }

  /** Muddati o'tganlarni yopadi va kodning o'zini o'chiradi (bazada eski kodlar saqlanmaydi) */
  sweep(): number {
    const now = nowIso();
    const expired = Number(this.db.prepare("UPDATE deliveries SET status = 'EXPIRED' WHERE status = 'WAITING' AND expires_at <= ?").run(now).changes);
    this.db.prepare("UPDATE deliveries SET code = '' WHERE code <> '' AND (expires_at <= ? OR status IN ('USED', 'EXPIRED'))").run(now);
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    this.db.prepare('DELETE FROM login_links WHERE expires_at <= ?').run(now);
    return expired;
  }

  listDeliveries(f: { projectId?: string; status?: string; limit: number; offset: number }): { items: Delivery[]; total: number } {
    const cond: string[] = [];
    const args: (string | number)[] = [];
    if (f.projectId) { cond.push('project_id = ?'); args.push(f.projectId); }
    if (f.status) { cond.push('status = ?'); args.push(f.status); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const items = (this.db.prepare(`SELECT * FROM deliveries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, f.limit, f.offset) as Row[]).map(toDelivery);
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM deliveries ${where}`).get(...args) as Row).n);
    return { items, total };
  }

  stats(): { today: Record<string, number>; contacts: number; projects: number; days: Array<{ day: string; sent: number; waiting: number }> } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const today: Record<string, number> = { WAITING: 0, SENT: 0, EXPIRED: 0, FAILED: 0, USED: 0 };
    for (const r of this.db.prepare('SELECT status, COUNT(*) AS n FROM deliveries WHERE created_at >= ? GROUP BY status').all(start.toISOString()) as Row[]) {
      today[String(r.status)] = Number(r.n);
    }
    // Kunlar server vaqt zonasida (TZ): yarim tundan yarim tungacha
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - 6);
    const rows = this.db
      .prepare("SELECT date(created_at, 'localtime') AS day, SUM(status IN ('SENT', 'USED')) AS sent, SUM(status IN ('WAITING', 'EXPIRED', 'FAILED')) AS waiting FROM deliveries WHERE created_at >= ? GROUP BY day ORDER BY day")
      .all(weekStart.toISOString()) as Row[];
    const byDay = new Map(rows.map(r => [String(r.day), { sent: Number(r.sent), waiting: Number(r.waiting) }]));
    const pad = (n: number) => String(n).padStart(2, '0');
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { day, ...(byDay.get(day) ?? { sent: 0, waiting: 0 }) };
    });
    return {
      today,
      contacts: Number((this.db.prepare('SELECT COUNT(*) AS n FROM contacts').get() as Row).n),
      projects: Number((this.db.prepare('SELECT COUNT(*) AS n FROM projects').get() as Row).n),
      days,
    };
  }

  // ---- sozlamalar --------------------------------------------------------------------------

  getSetting(key: string): string | undefined {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined;
    return r ? String(r.value) : undefined;
  }

  allSettings(): Record<string, string> {
    return Object.fromEntries((this.db.prepare('SELECT key, value FROM settings').all() as Row[]).map(r => [String(r.key), String(r.value)]));
  }

  setSetting(key: string, value: string): void {
    if (value === '') this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    else this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  // ---- admin sessiyalari -------------------------------------------------------------------

  createSession(tgId: number, ttlSec = 7 * 86_400): string {
    const token = randomToken(32);
    this.db.prepare('INSERT INTO sessions (token, tg_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), tgId, inSeconds(ttlSec));
    return token;
  }

  sessionUser(token: string): number | undefined {
    const r = this.db.prepare('SELECT tg_id FROM sessions WHERE token = ? AND expires_at > ?').get(sha256(token), nowIso()) as Row | undefined;
    return r ? Number(r.tg_id) : undefined;
  }

  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(sha256(token));
  }

  /** Brauzer uchun bir martalik kirish havolasi (botdagi /admin) */
  createLoginLink(tgId: number, ttlSec = 600): string {
    const token = randomToken(24);
    this.db.prepare('INSERT INTO login_links (token, tg_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), tgId, inSeconds(ttlSec));
    return token;
  }

  consumeLoginLink(token: string): number | undefined {
    const hash = sha256(token);
    const r = this.db.prepare('SELECT tg_id FROM login_links WHERE token = ? AND expires_at > ?').get(hash, nowIso()) as Row | undefined;
    this.db.prepare('DELETE FROM login_links WHERE token = ?').run(hash);
    return r ? Number(r.tg_id) : undefined;
  }
}
