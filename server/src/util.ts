import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Telefonni yagona ko'rinishga keltiradi: faqat raqamlar, oldida «+». Noto'g'ri bo'lsa null */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  return `+${digits}`;
}

/** +998 90 *** ** 01 — loglar va panel uchun */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, phone.length - 7)}•••${phone.slice(-2)}`;
}

/** URL va Telegram start parametri uchun xavfsiz tasodifiy satr (A-Z a-z 0-9 _ -) */
export const randomToken = (bytes = 18): string => randomBytes(bytes).toString('base64url');

export const randomId = (): string => randomBytes(12).toString('hex');

/** n xonali raqamli kod */
export const randomCode = (length: number): string =>
  Array.from({ length }, () => String(randomInt(0, 10))).join('');

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Vaqtga bog'liq bo'lmagan taqqoslash */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const nowIso = (): string => new Date().toISOString();
export const inSeconds = (sec: number): string => new Date(Date.now() + sec * 1000).toISOString();

/** HTML parse_mode uchun matnni xavfsiz qiladi */
export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
