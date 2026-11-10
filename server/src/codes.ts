// Kodlarni yetkazish. Loyiha kod so'raydi → raqam Telegram'ga ulangan bo'lsa kod darhol boradi,
// aks holda botga havola qaytariladi: foydalanuvchi «Start» bosib raqamini yuborgach kod yetkaziladi.
import type { Contact, Delivery, Project, Store } from './store.js';
import { codeMessage, langOf, type Lang } from './texts.js';
import { maskPhone, normalizePhone, randomCode, safeEqual } from './util.js';

/** Telegram'ga xabar yuborish (testlarda soxtasi beriladi) */
export interface Messenger {
  /** false — foydalanuvchi botni to'xtatgan yoki chat topilmadi */
  sendCode(chatId: number, html: string, code: string, lang: Lang): Promise<boolean>;
}

export class GatewayError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Record<string, unknown>) {
    super(message);
  }
}

export interface RequestResult {
  id: string;
  status: 'SENT' | 'WAITING';
  /** Raqam hali ulanmagan: foydalanuvchi shu havola orqali botga kiradi */
  link?: string;
  expiresInSec: number;
}

const MAX_PER_10_MIN = 5;
const MAX_ATTEMPTS = 5;
const MIN_TTL = 30;
const MAX_TTL = 3600;

export class CodeService {
  constructor(
    private readonly store: Store,
    private readonly messenger: Messenger,
    private readonly botUsername: () => string,
  ) {}

  link(token: string): string {
    return `https://t.me/${this.botUsername()}?start=${token}`;
  }

  /**
   * SEND — kodni loyiha o'zi yaratgan (masalan, YUMS backendi), shlyuz faqat yetkazadi.
   * VERIFY — kodni shlyuz yaratadi, keyin /v1/verify/check bilan tekshiriladi.
   */
  async request(project: Project, input: { phone: string; code?: string; ttlSec?: number; lang?: string; mode: 'SEND' | 'VERIFY' }): Promise<RequestResult> {
    if (!project.active) throw new GatewayError(403, 'PROJECT_DISABLED', 'Loyiha o‘chirilgan');
    const phone = normalizePhone(input.phone);
    if (!phone) throw new GatewayError(400, 'PHONE_INVALID', 'Telefon raqami noto‘g‘ri');
    if (this.store.recentCount(project.id, phone, 600) >= MAX_PER_10_MIN) {
      throw new GatewayError(429, 'TOO_MANY_REQUESTS', 'Bu raqamga juda ko‘p kod so‘raldi, 10 daqiqadan keyin urinib ko‘ring');
    }
    let code = input.code?.trim() ?? '';
    if (input.mode === 'SEND' && !/^[A-Za-z0-9]{3,12}$/.test(code)) throw new GatewayError(400, 'CODE_INVALID', 'Kod 3–12 ta harf yoki raqam bo‘lishi kerak');
    if (input.mode === 'VERIFY') code = randomCode(project.codeLength);
    const ttlSec = Math.min(MAX_TTL, Math.max(MIN_TTL, Math.round(input.ttlSec ?? project.ttlSec)));
    const delivery = this.store.insertDelivery({ projectId: project.id, phone, code, mode: input.mode, ttlSec, lang: input.lang ?? null });

    const contact = this.store.contactByPhone(phone);
    if (contact?.blocked) {
      this.store.setStatus(delivery.id, 'FAILED');
      throw new GatewayError(403, 'PHONE_BLOCKED', 'Bu raqamga kod yuborish cheklangan');
    }
    if (contact && (await this.send(delivery, contact, project))) {
      return { id: delivery.id, status: 'SENT', expiresInSec: ttlSec };
    }
    return { id: delivery.id, status: 'WAITING', link: this.link(delivery.linkToken), expiresInSec: ttlSec };
  }

  /** VERIFY rejimidagi kodni tekshirish */
  check(project: Project, input: { id?: string; phone?: string; code: string }): { valid: boolean; attemptsLeft: number } {
    const phone = input.phone ? normalizePhone(input.phone) : null;
    const d = input.id ? this.store.deliveryById(input.id) : phone ? this.store.latestVerify(project.id, phone) : undefined;
    if (!d || d.projectId !== project.id || d.mode !== 'VERIFY') throw new GatewayError(404, 'NOT_FOUND', 'So‘rov topilmadi');
    if (d.status === 'USED') throw new GatewayError(409, 'ALREADY_USED', 'Kod allaqachon ishlatilgan');
    if (d.expiresAt <= new Date().toISOString() || d.status === 'EXPIRED') throw new GatewayError(410, 'EXPIRED', 'Kod muddati tugagan');
    if (d.attempts >= MAX_ATTEMPTS) throw new GatewayError(429, 'TOO_MANY_ATTEMPTS', 'Urinishlar tugadi, yangi kod so‘rang');
    if (d.code && safeEqual(d.code, input.code.trim())) {
      this.store.setStatus(d.id, 'USED');
      return { valid: true, attemptsLeft: MAX_ATTEMPTS - d.attempts };
    }
    const attempts = this.store.addAttempt(d.id);
    return { valid: false, attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
  }

  status(project: Project, id: string): { id: string; status: Delivery['status']; expiresAt: string } {
    const d = this.store.deliveryById(id);
    if (!d || d.projectId !== project.id) throw new GatewayError(404, 'NOT_FOUND', 'So‘rov topilmadi');
    return { id: d.id, status: d.status, expiresAt: d.expiresAt };
  }

  /** Raqam endigina tasdiqlandi: shu raqamni kutayotgan barcha kodlar yuboriladi */
  async deliverWaiting(contact: Contact): Promise<number> {
    let sent = 0;
    for (const d of this.store.waitingFor(contact.phone)) {
      const project = this.store.getProject(d.projectId);
      if (project && (await this.send(d, contact, project))) sent += 1;
    }
    return sent;
  }

  /** Start havolasidagi so'rov: kimniki va hali amaldami */
  inspectToken(token: string): { delivery: Delivery; expired: boolean } | undefined {
    const d = this.store.deliveryByToken(token);
    if (!d) return undefined;
    return { delivery: d, expired: d.status !== 'WAITING' || d.expiresAt <= new Date().toISOString() };
  }

  masked(phone: string): string {
    return maskPhone(phone);
  }

  private async send(d: Delivery, contact: Contact, project: Project): Promise<boolean> {
    const lang = langOf(d.lang ?? contact.lang);
    const minutes = Math.max(1, Math.round((Date.parse(d.expiresAt) - Date.now()) / 60_000));
    const ok = await this.messenger.sendCode(contact.tgId, codeMessage(lang, project.name, d.code, minutes, project.template), d.code, lang);
    if (ok) {
      this.store.setStatus(d.id, 'SENT');
      this.store.touchContact(contact.tgId);
    }
    return ok;
  }
}
