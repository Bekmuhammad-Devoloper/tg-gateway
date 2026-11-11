import { useEffect, useState } from 'react';

import { api, type Project } from '../api';
import { copyText, Empty, errorText, fmtDate, Icon, Modal, Spinner, useUi } from '../ui';

const TTL_OPTIONS = [60, 120, 180, 300, 600, 900, 1800, 3600];
const minutes = (sec: number) => (sec < 60 ? `${sec} soniya` : `${Math.round(sec / 60)} daqiqa`);

/** Telegram HTML'ining ruxsat etilgan teglarini saqlab, qolganini xavfsiz ko'rsatadi */
function previewHtml(template: string, name: string, length: number, ttlSec: number): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const code = '123456789'.slice(0, length);
  const min = String(Math.max(1, Math.round(ttlSec / 60)));
  const source = template.trim()
    ? template
    : `🔐 <b>{project}</b>\n\nTasdiqlash kodingiz:\n{code}\n\n⏱ {minutes} daqiqa amal qiladi\n🚫 Kodni hech kimga bermang — hatto xodimlarga ham.`;
  return esc(source)
    .replace(/&lt;(\/?)(b|i|u|s|code)&gt;/g, '<$1$2>')
    .replace(/\{project\}/g, esc(name || 'Loyiha'))
    .replace(/\{minutes\}/g, min)
    .replace(/\{code\}/g, `<code>${code}</code>`)
    .replace(/\n/g, '<br>');
}

function ProjectForm({ initial, onClose, onSaved }: { initial?: Project; onClose: () => void; onSaved: (p: Project, apiKey?: string) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [codeLength, setCodeLength] = useState(initial?.codeLength ?? 5);
  const [ttlSec, setTtlSec] = useState(initial?.ttlSec ?? 300);
  const [template, setTemplate] = useState(initial?.template ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { name: name.trim(), codeLength, ttlSec, template };
      if (initial) onSaved(await api.patch<Project>(`/projects/${initial.id}`, body));
      else {
        const r = await api.post<{ project: Project; apiKey: string }>('/projects', body);
        onSaved(r.project, r.apiKey);
      }
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Loyihani tahrirlash' : 'Yangi loyiha'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn primary" disabled={busy || name.trim().length < 2} onClick={save}>
            {initial ? 'Saqlash' : 'Yaratish'}
          </button>
        </>
      }
    >
      <div className="form">
        <label className="field">
          <span>Nomi</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: YUMS Taxi" maxLength={60} autoFocus />
          <small className="muted">Foydalanuvchi kod xabarida shu nomni ko‘radi</small>
        </label>
        <div className="row-2">
          <label className="field">
            <span>Kod uzunligi</span>
            <select value={codeLength} onChange={e => setCodeLength(Number(e.target.value))}>
              {[4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>
                  {n} ta raqam
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amal qilish muddati</span>
            <select value={ttlSec} onChange={e => setTtlSec(Number(e.target.value))}>
              {(TTL_OPTIONS.includes(ttlSec) ? TTL_OPTIONS : [...TTL_OPTIONS, ttlSec].sort((a, b) => a - b)).map(s => (
                <option key={s} value={s}>
                  {minutes(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <small className="muted">Kod uzunligi shlyuz o‘zi yaratadigan kodlar (/v1/verify) uchun. /v1/send da kodni loyihangiz beradi.</small>
        <label className="field">
          <span>Xabar shabloni (ixtiyoriy)</span>
          <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={4} maxLength={1000} placeholder="Bo‘sh qoldirilsa — standart chiroyli xabar" />
          <small className="muted">
            O‘rinbosarlar: <code>{'{project}'}</code> <code>{'{code}'}</code> <code>{'{minutes}'}</code> · teglar: &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;code&gt;
          </small>
        </label>
        <div className="field">
          <span>Ko‘rinishi</span>
          <div className="tg-preview">
            <div className="bubble" dangerouslySetInnerHTML={{ __html: previewHtml(template, name, codeLength, ttlSec) }} />
            <div className="bubble-btn">
              <Icon name="copy" size={15} /> Kodni nusxalash
            </div>
          </div>
        </div>
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  );
}

function KeyModal({ project, apiKey, onClose }: { project: Project; apiKey: string; onClose: () => void }) {
  const { toast } = useUi();
  const origin = location.origin;
  const snippet = `curl -X POST ${origin}/v1/send \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+998901234567","code":"12345"}'`;
  const copy = async (text: string) => toast((await copyText(text)) ? 'Nusxalandi' : 'Nusxalab bo‘lmadi', 'ok');

  return (
    <Modal
      title={`${project.name}: API kalit`}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          Saqladim
        </button>
      }
    >
      <div className="form">
        <div className="alert warn">
          <Icon name="alert" size={18} />
          <span>Kalit faqat hozir ko‘rsatiladi. Uni loyihangiz serverining muhit o‘zgaruvchisiga saqlang.</span>
        </div>
        <div className="secret">
          <code>{apiKey}</code>
          <button className="btn sm" onClick={() => copy(apiKey)}>
            <Icon name="copy" size={16} /> Nusxalash
          </button>
        </div>
        <div className="field">
          <span>Sinab ko‘rish</span>
          <pre className="code-block">{snippet}</pre>
          <button className="btn ghost sm" onClick={() => copy(snippet)}>
            <Icon name="copy" size={16} /> Buyruqni nusxalash
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TestModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [phone, setPhone] = useState('+998');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; link?: string } | null>(null);
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.post<{ status: string; link?: string }>(`/projects/${project.id}/test`, { phone }));
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };

  return (
    <Modal
      title="Sinov kodi"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Yopish
          </button>
          <button className="btn primary" disabled={busy || phone.replace(/\D/g, '').length < 9} onClick={send}>
            <Icon name="send" size={16} /> Yuborish
          </button>
        </>
      }
    >
      <div className="form">
        <p className="muted">«{project.name}» nomidan tasodifiy kod yuboriladi.</p>
        <label className="field">
          <span>Telefon raqami</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="+998 90 123 45 67" autoFocus />
        </label>
        {result?.status === 'SENT' && (
          <div className="alert good">
            <Icon name="check" size={18} />
            <span>Kod Telegram’ga yuborildi.</span>
          </div>
        )}
        {result?.status === 'WAITING' && (
          <div className="alert warn">
            <Icon name="clock" size={18} />
            <span>
              Bu raqam hali botga ulanmagan. Havolani oching va raqamni yuboring — kod darhol keladi:{' '}
              <a href={result.link} target="_blank" rel="noreferrer">
                {result.link}
              </a>
            </span>
          </div>
        )}
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  );
}

export function Projects() {
  const { toast, confirm } = useUi();
  const [list, setList] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ project?: Project } | null>(null);
  const [key, setKey] = useState<{ project: Project; apiKey: string } | null>(null);
  const [test, setTest] = useState<Project | null>(null);

  const load = () =>
    api
      .get<Project[]>('/projects')
      .then(setList)
      .catch(e => setError(errorText(e)));
  useEffect(() => void load(), []);

  const toggle = async (p: Project) => {
    try {
      await api.patch(`/projects/${p.id}`, { active: !p.active });
      toast(p.active ? 'Loyiha to‘xtatildi' : 'Loyiha yoqildi');
      void load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  const rotate = async (p: Project) => {
    const ok = await confirm({ title: 'Kalitni yangilash', text: `«${p.name}» ning hozirgi kaliti darhol ishlamay qoladi. Yangi kalitni loyiha serveriga qo‘yishingiz kerak bo‘ladi.`, action: 'Yangilash', danger: true });
    if (!ok) return;
    try {
      const r = await api.post<{ apiKey: string }>(`/projects/${p.id}/rotate-key`);
      setKey({ project: p, apiKey: r.apiKey });
      void load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  const remove = async (p: Project) => {
    const ok = await confirm({ title: 'Loyihani o‘chirish', text: `«${p.name}» va uning kodlar tarixi o‘chiriladi. API kalit ishlamay qoladi.`, action: 'O‘chirish', danger: true });
    if (!ok) return;
    try {
      await api.del(`/projects/${p.id}`);
      toast('Loyiha o‘chirildi');
      void load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  if (error && !list) return <div className="alert bad">{error}</div>;
  if (!list) return <Spinner />;

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <p className="muted">Har bir loyiha (ilova, sayt) o‘z API kaliti bilan kod yuboradi.</p>
        <button className="btn primary" onClick={() => setForm({})}>
          <Icon name="plus" size={18} /> Yangi loyiha
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon="projects" title="Hali loyiha yo‘q" text="Birinchi loyihani qo‘shing — masalan, YUMS Taxi. API kalit beriladi." />
        </div>
      ) : (
        <div className="cards">
          {list.map((p, i) => (
            <article key={p.id} className={`card project ${p.active ? '' : 'off'} reveal`} style={{ ['--i' as string]: i }}>
              <div className="project-head">
                <div className="project-mark">{p.name.slice(0, 1).toUpperCase()}</div>
                <div className="grow min0">
                  <h3 className="ellipsis">{p.name}</h3>
                  <span className="project-meta">
                    <span className={`state-pill ${p.active ? 'on' : ''}`}>
                      <i />
                      {p.active ? 'Faol' : 'To‘xtatilgan'}
                    </span>
                    <span className="muted">{fmtDate(p.createdAt).slice(0, 10)} dan</span>
                  </span>
                </div>
                <button className={`switch ${p.active ? 'on' : ''}`} role="switch" aria-checked={p.active} aria-label="Faol" onClick={() => toggle(p)}>
                  <i />
                </button>
              </div>

              <div className="project-stats">
                <div>
                  <b>{p.activity?.today ?? 0}</b>
                  <span>bugun</span>
                </div>
                <div>
                  <b>{p.activity?.week ?? 0}</b>
                  <span>7 kunda</span>
                </div>
                <div>
                  <b>{p.activity?.week ? `${Math.round(((p.activity.delivered ?? 0) / p.activity.week) * 100)}%` : '—'}</b>
                  <span>yetkazildi</span>
                </div>
              </div>

              <div className="key-row">
                <Icon name="key" size={16} />
                <code>{p.keyPrefix}••••••</code>
                <button className="icon-btn sm" onClick={() => rotate(p)} title="Yangi kalit" aria-label="Yangi kalit">
                  <Icon name="refresh" size={16} />
                </button>
              </div>

              <div className="project-tags">
                <span>
                  <Icon name="lock" size={14} /> {p.codeLength} raqam
                </span>
                <span>
                  <Icon name="clock" size={14} /> {minutes(p.ttlSec)}
                </span>
                <span>
                  <Icon name="edit" size={14} /> {p.template.trim() ? 'O‘z shabloni' : 'Standart xabar'}
                </span>
              </div>

              <div className="project-actions">
                <button className="btn sm primary" onClick={() => setTest(p)} disabled={!p.active}>
                  <Icon name="send" size={16} /> Sinov kodi
                </button>
                <button className="btn sm ghost" onClick={() => setForm({ project: p })}>
                  <Icon name="edit" size={16} /> Tahrirlash
                </button>
                <button className="icon-btn danger-text" onClick={() => remove(p)} title="O‘chirish" aria-label="O‘chirish">
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {form && (
        <ProjectForm
          initial={form.project}
          onClose={() => setForm(null)}
          onSaved={(p, apiKey) => {
            setForm(null);
            void load();
            if (apiKey) setKey({ project: p, apiKey });
            else toast('Saqlandi');
          }}
        />
      )}
      {key && <KeyModal project={key.project} apiKey={key.apiKey} onClose={() => setKey(null)} />}
      {test && <TestModal project={test} onClose={() => setTest(null)} />}
    </div>
  );
}
