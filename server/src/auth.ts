import { createHmac } from 'node:crypto';

import { safeEqual } from './util.js';

export interface WebAppUser {
  id: number;
  firstName: string;
  lastName?: string;
}

/**
 * Telegram Mini App `initData` imzosini tekshiradi (https://core.telegram.org/bots/webapps).
 * Imzo bot tokeni bilan qilinadi, shuning uchun uni soxtalashtirib bo'lmaydi.
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 86_400): WebAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheck).digest('hex');
  if (!safeEqual(expected, hash)) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as { id?: number; first_name?: string; last_name?: string } | null;
    if (!user?.id) return null;
    return { id: user.id, firstName: user.first_name ?? '', lastName: user.last_name };
  } catch {
    return null;
  }
}

/** Testlar uchun: imzolangan initData yasash */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheck = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
