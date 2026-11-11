// Admin API bilan ishlash. Sessiya tokeni brauzerda saqlanadi (7 kun).

export interface Project {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  template: string;
  codeLength: number;
  ttlSec: number;
  createdAt: string;
  /** Bugun va oxirgi 7 kunda so'ralgan kodlar, ulardan yetkazilgani */
  activity?: { today: number; week: number; delivered: number };
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

export type DeliveryStatus = 'WAITING' | 'SENT' | 'EXPIRED' | 'FAILED' | 'USED';

export interface DeliveryRow {
  id: string;
  project: string;
  phone: string;
  mode: 'SEND' | 'VERIFY';
  status: DeliveryStatus;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
  expiresAt: string;
}

export interface Stats {
  today: Record<DeliveryStatus, number>;
  contacts: number;
  projects: number;
  days: Array<{ day: string; sent: number; waiting: number }>;
}

export interface Admin {
  tgId: number;
  name: string;
  addedAt: string;
}

export interface Me {
  tgId: number;
  bot: string;
  name: string;
}

export interface Page<T> {
  data: T;
  meta?: { page: number; total: number };
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

const KEY = 'tcg.session';

let token = '';
try {
  token = localStorage.getItem(KEY) ?? '';
} catch {
  token = '';
}

export const hasSession = (): boolean => token !== '';

export function setSession(value: string): void {
  token = value;
  photoCache.clear();
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    /* saqlab bo'lmasa — faqat shu oynada ishlaydi */
  }
}

let onUnauthorized: () => void = () => {};
export const whenUnauthorized = (fn: () => void): void => {
  onUnauthorized = fn;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<Page<T>> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/admin/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Server bilan aloqa yo‘q');
  }
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; meta?: Page<T>['meta']; error?: { code: string; message: string } } | null;
  if (!res.ok || !json?.ok) {
    if (res.status === 401 && token) {
      setSession('');
      onUnauthorized();
    }
    throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Xatolik yuz berdi');
  }
  return { data: json.data as T, meta: json.meta };
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path).then(r => r.data),
  page: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body).then(r => r.data),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body).then(r => r.data),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body).then(r => r.data),
  del: <T>(path: string) => request<T>('DELETE', path).then(r => r.data),
};

/** Profil rasmlari bir marta yuklanadi va sahifalar almashganda qayta so'ralmaydi */
const photoCache = new Map<string, Promise<string | null>>();

/** Telegram profil rasmi (admin — 'me', bot — 'bot'): brauzer URL'i yoki rasm bo'lmasa null */
export function photoUrl(who: 'me' | 'bot'): Promise<string | null> {
  const hit = photoCache.get(who);
  if (hit) return hit;
  const loading = fetch(`/admin/api/photo/${who}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
    .then(async res => (res.ok ? URL.createObjectURL(await res.blob()) : null))
    .catch(() => null);
  photoCache.set(who, loading);
  return loading;
}

/** Botning nomi (kirish sahifasi uchun, sessiyasiz) */
export async function botName(): Promise<string> {
  try {
    const r = (await (await fetch('/health')).json()) as { bot?: string };
    return r.bot ?? '';
  } catch {
    return '';
  }
}
