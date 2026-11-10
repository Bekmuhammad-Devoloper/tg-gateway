import { useEffect, useState } from 'react';

import { api, type Admin, type Me } from '../api';
import { copyText, errorText, fmtDate, Icon, Spinner, useUi } from '../ui';

const LANGS = [
  { id: 'uz', label: 'O‘zbekcha' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
] as const;

const ENDPOINTS = [
  { method: 'POST', path: '/v1/send', body: '{ phone, code, ttlSec?, lang? }', text: 'Kodni loyihangiz yaratadi, shlyuz Telegram’ga yetkazadi.' },
  { method: 'POST', path: '/v1/verify', body: '{ phone, ttlSec?, lang? }', text: 'Kodni shlyuz yaratadi va yuboradi.' },
  { method: 'POST', path: '/v1/verify/check', body: '{ id | phone, code }', text: '/v1/verify kodini tekshirish → { valid, attemptsLeft }.' },
  { method: 'GET', path: '/v1/status/:id', body: '', text: 'So‘rov holati: WAITING, SENT, USED, EXPIRED, FAILED.' },
];

export function Settings({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const { toast, confirm } = useUi();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [lang, setLang] = useState<(typeof LANGS)[number]['id']>('uz');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get<{ settings: Record<string, string>; admins: Admin[] }>('/settings')
      .then(r => {
        setSettings(r.settings);
        setDraft(r.settings);
        setAdmins(r.admins);
      })
      .catch(e => toast(errorText(e), 'error'));
  useEffect(() => void load(), []);

  const key = `welcome.${lang}`;
  const dirty = settings !== null && LANGS.some(l => (draft[`welcome.${l.id}`] ?? '') !== (settings[`welcome.${l.id}`] ?? ''));

  const saveTexts = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(LANGS.map(l => [`welcome.${l.id}`, draft[`welcome.${l.id}`] ?? '']));
      const next = await api.put<Record<string, string>>('/settings', body);
      setSettings(next);
      setDraft(next);
      toast('Saqlandi');
    } catch (e) {
      toast(errorText(e), 'error');
    }
    setBusy(false);
  };

  const addAdmin = async () => {
    const tgId = Number(newId.trim());
    if (!Number.isSafeInteger(tgId) || tgId <= 0) return toast('Telegram ID raqam bo‘lishi kerak', 'error');
    try {
      setAdmins(await api.post<Admin[]>('/admins', { tgId, name: newName.trim() }));
      setNewId('');
      setNewName('');
      toast('Administrator qo‘shildi');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  const removeAdmin = async (a: Admin) => {
    const ok = await confirm({ title: 'Administratorni olib tashlash', text: `${a.name || a.tgId} panelga kira olmaydi.`, action: 'Olib tashlash', danger: true });
    if (!ok) return;
    try {
      setAdmins(await api.del<Admin[]>(`/admins/${a.tgId}`));
      toast('Olib tashlandi');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  if (!settings) return <Spinner />;

  return (
    <div className="stack-lg">
      <section className="card">
        <h2>Xush kelibsiz matni</h2>
        <p className="muted">Foydalanuvchi botga birinchi marta kirganda ko‘radi. Bo‘sh qoldirilsa — standart matn. <code>{'{name}'}</code> — foydalanuvchi ismi.</p>
        <div className="segmented" role="tablist">
          {LANGS.map(l => (
            <button key={l.id} role="tab" aria-selected={lang === l.id} className={lang === l.id ? 'active' : ''} onClick={() => setLang(l.id)}>
              {l.label}
              {draft[`welcome.${l.id}`]?.trim() ? ' •' : ''}
            </button>
          ))}
        </div>
        <textarea className="mt" rows={6} maxLength={2000} value={draft[key] ?? ''} onChange={e => setDraft({ ...draft, [key]: e.target.value })} placeholder="Standart matn ishlatiladi" />
        <div className="actions end">
          <button className="btn primary" disabled={!dirty || busy} onClick={saveTexts}>
            Saqlash
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Administratorlar</h2>
        <div className="list flat">
          {admins.map(a => (
            <div key={a.tgId} className="list-row">
              <div className="avatar">{(a.name || 'A').slice(0, 1).toUpperCase()}</div>
              <div className="grow min0">
                <div className="row-title">
                  <b>{a.name || 'Nomsiz'}</b>
                  {a.tgId === me.tgId && <span className="badge info">Siz</span>}
                </div>
                <div className="row-sub">
                  <span className="mono">ID {a.tgId}</span>
                  <span className="muted">{fmtDate(a.addedAt)}</span>
                </div>
              </div>
              {a.tgId !== me.tgId && (
                <button className="icon-btn danger-text" onClick={() => removeAdmin(a)} aria-label="Olib tashlash">
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="add-row">
          <input value={newId} onChange={e => setNewId(e.target.value)} inputMode="numeric" placeholder="Telegram ID" aria-label="Telegram ID" />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ismi (ixtiyoriy)" aria-label="Ismi" />
          <button className="btn" onClick={addAdmin} disabled={!newId.trim()}>
            <Icon name="plus" size={16} /> Qo‘shish
          </button>
        </div>
        <p className="hint">Telegram ID’ni bilish uchun odam @userinfobot ga yozadi.</p>
      </section>

      <section className="card">
        <h2>Ulanish (API)</h2>
        <p className="muted">
          Har so‘rovda <code>Authorization: Bearer &lt;API kalit&gt;</code>. Raqam botga ulanmagan bo‘lsa javobda <code>status: "WAITING"</code> va <code>link</code> keladi — ilova shu havolani ochadi.
        </p>
        <div className="endpoints">
          {ENDPOINTS.map(e => (
            <div key={e.path} className="endpoint">
              <div>
                <span className={`method ${e.method.toLowerCase()}`}>{e.method}</span>
                <code>{e.path}</code>
                {e.body && <code className="muted">{e.body}</code>}
              </div>
              <span className="muted">{e.text}</span>
            </div>
          ))}
        </div>
        <button className="btn ghost sm" onClick={async () => toast((await copyText(location.origin)) ? 'Manzil nusxalandi' : 'Nusxalab bo‘lmadi')}>
          <Icon name="copy" size={16} /> {location.origin}
        </button>
      </section>

      <button className="btn ghost danger-text block" onClick={onLogout}>
        <Icon name="logout" size={18} /> Chiqish
      </button>
    </div>
  );
}
