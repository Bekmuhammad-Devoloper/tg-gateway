// Umumiy UI bo'laklari: ikonlar, oyna, bildirishnoma, tasdiqlash, holat belgisi, sahifalash.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import type { DeliveryStatus } from './api';

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  projects: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7M16 10h.01',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M5.6 5.6l12.8 12.8',
  unlink: 'M18.8 13.4 21 11.2a5 5 0 0 0-7.1-7.1l-2.2 2.2M5.2 10.6 3 12.8a5 5 0 0 0 7.1 7.1l2.2-2.2M8 2v3M2 8h3M16 22v-3M22 16h-3',
  refresh: 'M21 12a9 9 0 0 1-15.4 6.4L3 16M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5M3 21v-5h5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-5-5',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  x: 'M18 6 6 18M6 6l12 12',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
  telegram: 'M21.5 4.5 2.8 11.7c-.9.4-.9 1.5 0 1.8l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.8 3.5c.6.4 1.4.1 1.6-.6l3.3-15.5c.2-.9-.7-1.6-1.6-1.5zM9.5 14.5l8.3-6.3',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4',
  chevron: 'M9 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---- oyna (mobil ekranda pastdan chiqadi) ---------------------------------------------------

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---- bildirishnoma va tasdiqlash -------------------------------------------------------------

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

interface UiApi {
  toast: (text: string, kind?: Toast['kind']) => void;
  confirm: (opts: { title: string; text: string; action: string; danger?: boolean }) => Promise<boolean>;
}

const UiContext = createContext<UiApi>({ toast: () => {}, confirm: async () => false });
export const useUi = (): UiApi => useContext(UiContext);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<{ title: string; text: string; action: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const seq = useRef(0);

  const toast = useCallback<UiApi['toast']>((text, kind = 'ok') => {
    const id = ++seq.current;
    setToasts(list => [...list, { id, text, kind }]);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(kind === 'ok' ? 'success' : 'error');
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 3200);
  }, []);

  const confirm = useCallback<UiApi['confirm']>(opts => new Promise(resolve => setAsk({ ...opts, resolve })), []);

  const close = (v: boolean) => {
    ask?.resolve(v);
    setAsk(null);
  };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'ok' ? 'check' : 'alert'} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {ask && (
        <Modal
          title={ask.title}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => close(false)}>
                Bekor qilish
              </button>
              <button className={`btn ${ask.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>
                {ask.action}
              </button>
            </>
          }
        >
          <p className="muted">{ask.text}</p>
        </Modal>
      )}
    </UiContext.Provider>
  );
}

// ---- holat belgisi (rang + ikon + yozuv) -----------------------------------------------------

const STATUS: Record<DeliveryStatus, { label: string; icon: IconName; tone: string }> = {
  SENT: { label: 'Yetkazildi', icon: 'send', tone: 'info' },
  USED: { label: 'Tasdiqlandi', icon: 'check', tone: 'good' },
  WAITING: { label: 'Kutilmoqda', icon: 'clock', tone: 'warn' },
  EXPIRED: { label: 'Muddati o‘tdi', icon: 'x', tone: 'muted' },
  FAILED: { label: 'Yetkazilmadi', icon: 'alert', tone: 'bad' },
};

export const statusLabel = (s: DeliveryStatus): string => STATUS[s].label;

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s.tone}`}>
      <Icon name={s.icon} size={13} />
      {s.label}
    </span>
  );
}

export function Pager({ page, total, size = 50, onPage }: { page: number; total: number; size?: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Oldingi
      </button>
      <span className="muted">
        {page} / {pages}
      </span>
      <button className="btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Keyingi →
      </button>
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <b>{title}</b>
      {text && <p className="muted">{text}</p>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Yuklanmoqda" />;
}

// ---- yordamchilar ------------------------------------------------------------------------------

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 08.11.2026 14:05 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «3 daqiqa oldin» */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const sec = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (sec < 60) return 'hozirgina';
  if (sec < 3600) return `${Math.floor(sec / 60)} daqiqa oldin`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} soat oldin`;
  return fmtDate(iso);
}

/** Son 0 dan kerakli qiymatgacha silliq sanalib chiqadi (harakat kamaytirilgan bo'lsa — darhol) */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setValue(target);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = Math.round(start + (target - start) * eased);
      setValue(next);
      if (k < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : 'Xatolik yuz berdi');
