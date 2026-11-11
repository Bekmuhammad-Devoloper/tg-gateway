import { useEffect, useState } from 'react';

import { api, type DeliveryRow, type Me, type Stats } from '../api';
import { errorText, fmtAgo, Icon, StatusBadge, useCountUp, type IconName } from '../ui';

const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/** 1, 2, 5, 10, 20, 50 … — o'qga chiroyli yuqori chegara */
function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 4, 5, 10]) if (m * pow >= n) return m * pow;
  return 10 * pow;
}

function WeekChart({ days }: { days: Stats['days'] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...days.map(d => d.sent + d.waiting)));
  const ticks = [top, top / 2, 0];
  const total = days.reduce((s, d) => s + d.sent + d.waiting, 0);

  return (
    <div className="chart">
      <div className="chart-head">
        <div>
          <h2>Oxirgi 7 kun</h2>
          <span className="muted">{total} ta so‘rov</span>
        </div>
        <div className="legend">
          <span>
            <i className="swatch s1" />
            Yetkazildi
          </span>
          <span>
            <i className="swatch s2" />
            Yetkazilmadi
          </span>
        </div>
      </div>
      <div className="plot" onMouseLeave={() => setActive(null)}>
        <div className="grid">
          {ticks.map(v => (
            <div key={v} className="gridline">
              <span>{v}</span>
            </div>
          ))}
        </div>
        <div className="bars">
          {days.map((d, i) => {
            const sum = d.sent + d.waiting;
            const date = new Date(`${d.day}T00:00:00`);
            return (
              <button
                key={d.day}
                className={`col ${active === i ? 'active' : ''} ${i === days.length - 1 ? 'today' : ''}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(active === i ? null : i)}
                aria-label={`${d.day}: yetkazildi ${d.sent}, yetkazilmadi ${d.waiting}`}
              >
                <div className="stack grow-up" style={{ height: `${(sum / top) * 100}%`, animationDelay: `${i * 60}ms` }}>
                  {d.waiting > 0 && <div className="seg s2" style={{ flexGrow: d.waiting }} />}
                  {d.sent > 0 && <div className="seg s1" style={{ flexGrow: d.sent }} />}
                </div>
                {active === i && (
                  <div className={`tip ${i > 4 ? 'left' : ''}`}>
                    <b>
                      {WEEKDAYS[date.getDay()]}, {date.getDate()}.{String(date.getMonth() + 1).padStart(2, '0')}
                    </b>
                    <span>
                      <i className="swatch s1" />
                      Yetkazildi <b>{d.sent}</b>
                    </span>
                    <span>
                      <i className="swatch s2" />
                      Yetkazilmadi <b>{d.waiting}</b>
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="xaxis">
        {days.map((d, i) => (
          <span key={d.day} className={i === days.length - 1 ? 'today' : ''}>
            {i === days.length - 1 ? 'Bugun' : WEEKDAYS[new Date(`${d.day}T00:00:00`).getDay()]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tile({ icon, label, value, tone, index }: { icon: IconName; label: string; value: number; tone: string; index: number }) {
  const shown = useCountUp(value);
  return (
    <div className={`tile tone-${tone} reveal`} style={{ ['--i' as string]: index }}>
      <div className={`tile-icon ${tone}`}>
        <Icon name={icon} size={18} />
      </div>
      <span className="tile-value">{shown.toLocaleString('ru-RU')}</span>
      <span className="muted">{label}</span>
    </div>
  );
}

/** Bot holati: jonli nuqta, bugungi kodlar va yetkazish ulushi */
function Hero({ me, stats, onGo }: { me: Me; stats: Stats; onGo: (tab: string) => void }) {
  const t = stats.today;
  const total = t.SENT + t.USED + t.WAITING + t.EXPIRED + t.FAILED;
  const delivered = t.SENT + t.USED;
  const rate = total ? Math.round((delivered / total) * 100) : 100;
  const shownTotal = useCountUp(total);
  const shownRate = useCountUp(rate);

  return (
    <section className="hero reveal" style={{ ['--i' as string]: 0 }}>
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-top">
        <div className="bot-avatar">
          <Icon name="telegram" size={26} />
          <i className="live-dot" aria-hidden="true" />
        </div>
        <div className="grow min0">
          <b className="hero-bot">@{me.bot}</b>
          <span className="hero-status">
            <i className="pulse" aria-hidden="true" /> Bot faol · kodlar yetkazilmoqda
          </span>
        </div>
        <a className="hero-open" href={`https://t.me/${me.bot}`} target="_blank" rel="noreferrer" aria-label="Botni ochish" title="Botni ochish">
          <Icon name="send" size={18} />
        </a>
      </div>
      <div className="hero-numbers">
        <div>
          <span className="hero-big">{shownTotal}</span>
          <span className="hero-label">bugun so‘ralgan kod</span>
        </div>
        <div className="hero-rate">
          <svg viewBox="0 0 36 36" className="ring" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" className="ring-track" />
            <circle cx="18" cy="18" r="15.5" className="ring-fill" style={{ strokeDasharray: `${(shownRate / 100) * 97.4} 97.4` }} />
          </svg>
          <div>
            <span className="hero-rate-value">{shownRate}%</span>
            <span className="hero-label">yetkazildi</span>
          </div>
        </div>
      </div>
      <div className="hero-actions">
        <button className="chip-btn" onClick={() => onGo('projects')}>
          <Icon name="plus" size={16} /> Yangi loyiha
        </button>
        <button className="chip-btn" onClick={() => onGo('history')}>
          <Icon name="history" size={16} /> Kodlar tarixi
        </button>
      </div>
    </section>
  );
}

function Recent({ items, onGo }: { items: DeliveryRow[]; onGo: (tab: string) => void }) {
  return (
    <section className="card reveal" style={{ ['--i' as string]: 6 }}>
      <div className="card-head">
        <h2>So‘nggi kodlar</h2>
        <button className="link-btn" onClick={() => onGo('history')}>
          Hammasi <Icon name="chevron" size={16} />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="muted empty-line">Hali kod so‘ralmagan. Loyiha kod so‘raganda shu yerda paydo bo‘ladi.</p>
      ) : (
        <div className="feed">
          {items.map(d => (
            <div key={d.id} className="feed-row">
              <div className={`feed-icon ${d.status === 'USED' || d.status === 'SENT' ? 'ok' : d.status === 'WAITING' ? 'wait' : 'bad'}`}>
                <Icon name={d.status === 'WAITING' ? 'clock' : d.status === 'SENT' || d.status === 'USED' ? 'send' : 'alert'} size={16} />
              </div>
              <div className="grow min0">
                <b className="ellipsis">{d.project}</b>
                <span className="muted feed-sub">
                  <span className="mono">{d.phone}</span> · {fmtAgo(d.createdAt)}
                </span>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="stack-lg" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="skeleton" style={{ height: 196, borderRadius: 24 }} />
      <div className="tiles">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 118 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}

export function Dashboard({ me, onGo }: { me: Me; onGo: (tab: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<DeliveryRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => {
      api
        .get<Stats>('/stats')
        .then(s => {
          setStats(s);
          setError('');
        })
        .catch(e => setError(errorText(e)));
      api
        .page<DeliveryRow[]>('/deliveries?page=1')
        .then(r => setRecent(r.data.slice(0, 5)))
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  if (error && !stats) return <div className="alert bad">{error}</div>;
  if (!stats) return <DashboardSkeleton />;
  const t = stats.today;

  return (
    <div className="stack-lg">
      <Hero me={me} stats={stats} onGo={onGo} />

      <section>
        <h2 className="section-title">Bugun</h2>
        <div className="tiles">
          <Tile index={1} icon="send" label="Yetkazildi" value={t.SENT + t.USED} tone="info" />
          <Tile index={2} icon="check" label="Tasdiqlandi" value={t.USED} tone="good" />
          <Tile index={3} icon="clock" label="Kutilmoqda" value={t.WAITING} tone="warn" />
          <Tile index={4} icon="alert" label="Yetkazilmadi" value={t.EXPIRED + t.FAILED} tone="bad" />
        </div>
      </section>

      <section className="card reveal" style={{ ['--i' as string]: 5 }}>
        <WeekChart days={stats.days} />
      </section>

      <Recent items={recent} onGo={onGo} />

      <section className="tiles two">
        <button className="card link-card reveal" style={{ ['--i' as string]: 7 }} onClick={() => onGo('projects')}>
          <span className="link-icon">
            <Icon name="projects" />
          </span>
          <div className="grow">
            <b>{stats.projects} ta loyiha</b>
            <span className="muted">API kalitlar va xabar shablonlari</span>
          </div>
          <Icon name="chevron" size={18} />
        </button>
        <button className="card link-card reveal" style={{ ['--i' as string]: 8 }} onClick={() => onGo('contacts')}>
          <span className="link-icon">
            <Icon name="users" />
          </span>
          <div className="grow">
            <b>{stats.contacts} ta foydalanuvchi</b>
            <span className="muted">Telegram’ga ulangan raqamlar</span>
          </div>
          <Icon name="chevron" size={18} />
        </button>
      </section>

      {stats.projects === 0 && (
        <section className="card how reveal" style={{ ['--i' as string]: 9 }}>
          <h2>Qanday ishlaydi</h2>
          <ol>
            <li>
              <b>Loyiha qo‘shing</b> — «Loyihalar» bo‘limida. API kalit beriladi.
            </li>
            <li>
              <b>Backend kalit bilan</b> <code>POST /v1/send</code> ga telefon va kodni yuboradi.
            </li>
            <li>
              <b>Raqam ulangan bo‘lsa</b> kod darhol Telegram’ga keladi; aks holda javobda bot havolasi qaytadi — foydalanuvchi «Start» bosib raqamini yuboradi va kodni oladi.
            </li>
          </ol>
        </section>
      )}
    </div>
  );
}
