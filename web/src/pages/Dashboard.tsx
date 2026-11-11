import { useEffect, useState } from 'react';

import { api, type DeliveryRow, type Me, type Stats } from '../api';
import { errorText, fmtAgo, Icon, ProfilePhoto, StatusBadge, useCountUp, type IconName } from '../ui';

const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/** 1, 2, 5, 10, 20, 50 … — o'qga chiroyli yuqori chegara */
function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 4, 5, 10]) if (m * pow >= n) return m * pow;
  return 10 * pow;
}

/**
 * Silliq egri chiziq (monotonik kubik, Fritsch–Carlson): nuqtalar orasida yolg'on cho'qqi yoki
 * noldan pastga tushish chizmaydi. Koordinatalar 0..100 oralig'ida.
 */
function smoothPath(pts: Array<[number, number]>): string {
  const n = pts.length;
  if (n < 2) return '';
  const dx = pts.slice(0, -1).map((p, i) => pts[i + 1][0] - p[0]);
  const slope = pts.slice(0, -1).map((p, i) => (pts[i + 1][1] - p[1]) / dx[i]);
  const m = pts.map((_, i) => (i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    d += ` C${pts[i][0] + h / 3},${pts[i][1] + (m[i] * h) / 3} ${pts[i + 1][0] - h / 3},${pts[i + 1][1] - (m[i + 1] * h) / 3} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/** Ikki chiziq: yetkazildi va yetkazilmadi; bitta o'q, bugungi nuqtalar ajratilgan */
function WeekChart({ days }: { days: Stats['days'] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...days.map(d => Math.max(d.sent, d.waiting))));
  const ticks = [top, top / 2, 0];
  const total = days.reduce((s, d) => s + d.sent + d.waiting, 0);
  const PAD = 5;
  const step = (100 - 2 * PAD) / (days.length - 1);
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => 100 - (v / top) * 100;
  const sent = days.map((d, i): [number, number] => [x(i), y(d.sent)]);
  const missed = days.map((d, i): [number, number] => [x(i), y(d.waiting)]);
  const sentLine = smoothPath(sent);
  const area = `${sentLine} L${x(days.length - 1)},100 L${x(0)},100 Z`;
  const last = days.length - 1;

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
      <div className="plot line-plot" onMouseLeave={() => setActive(null)}>
        <div className="grid">
          {ticks.map(v => (
            <div key={v} className="gridline">
              <span>{v}</span>
            </div>
          ))}
        </div>
        <div className="line-draw">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="area-sent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#area-sent)" />
            <path d={smoothPath(missed)} className="line s2" />
            <path d={sentLine} className="line s1" />
          </svg>
        </div>
        {active !== null && <div className="crosshair" style={{ left: `${x(active)}%` }} />}
        {days.map((d, i) => (
          <span key={`m${d.day}`} className={`dot s2 ${i === last ? 'today' : ''} ${active === i ? 'on' : ''}`} style={{ left: `${x(i)}%`, top: `${y(d.waiting)}%`, animationDelay: `${120 + i * 150}ms` }} />
        ))}
        {days.map((d, i) => (
          <span key={`s${d.day}`} className={`dot s1 ${i === last ? 'today' : ''} ${active === i ? 'on' : ''}`} style={{ left: `${x(i)}%`, top: `${y(d.sent)}%`, animationDelay: `${120 + i * 150}ms` }} />
        ))}
        <span className="point-label" style={{ left: `${x(last)}%`, top: `${y(days[last].sent)}%` }}>
          {days[last].sent}
        </span>
        {days.map((d, i) => {
          const date = new Date(`${d.day}T00:00:00`);
          return (
            <button
              key={d.day}
              className="hit"
              style={{ left: `${x(i) - step / 2}%`, width: `${step}%` }}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(active === i ? null : i)}
              aria-label={`${d.day}: yetkazildi ${d.sent}, yetkazilmadi ${d.waiting}`}
            >
              {active === i && (
                <span className={`tip ${i > 3 ? 'left' : ''}`}>
                  <b>
                    {i === last ? 'Bugun' : WEEKDAYS[date.getDay()]}, {date.getDate()}.{String(date.getMonth() + 1).padStart(2, '0')}
                  </b>
                  <span>
                    <i className="swatch s1" />
                    Yetkazildi <b>{d.sent}</b>
                  </span>
                  <span>
                    <i className="swatch s2" />
                    Yetkazilmadi <b>{d.waiting}</b>
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="xaxis line-x">
        {days.map((d, i) => (
          <span key={d.day} className={i === last ? 'today' : ''} style={{ left: `${x(i)}%` }}>
            {i === last ? 'Bugun' : WEEKDAYS[new Date(`${d.day}T00:00:00`).getDay()]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tile({ icon, label, value, total, tone, index }: { icon: IconName; label: string; value: number; total: number; tone: string; index: number }) {
  const shown = useCountUp(value);
  const share = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`stat tone-${tone} reveal`} style={{ ['--i' as string]: index }}>
      <span className="stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <div className="stat-body">
        <span className="stat-value">{shown.toLocaleString('ru-RU')}</span>
        <span className="stat-label">{label}</span>
      </div>
      <span className="stat-share">{share}%</span>
      <span className="stat-bar" aria-hidden="true">
        <i style={{ width: `${share}%` }} />
      </span>
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
        <div className="bot-avatar-wrap">
          <ProfilePhoto who="bot" className="bot-avatar" fallback={<Icon name="telegram" size={22} />} />
        </div>
        <div className="grow min0">
          <b className="hero-bot">@{me.bot}</b>
          <span className="hero-status">
            <i className="pulse" aria-hidden="true" /> Bot faol
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
      <div className="skeleton" style={{ height: 168, borderRadius: 22 }} />
      <div className="tiles">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 76 }} />
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
  const todayTotal = t.SENT + t.USED + t.WAITING + t.EXPIRED + t.FAILED;

  return (
    <div className="stack-lg">
      <Hero me={me} stats={stats} onGo={onGo} />

      <section>
        <h2 className="section-title">Bugun</h2>
        <div className="tiles">
          <Tile index={1} icon="send" label="Yetkazildi" value={t.SENT + t.USED} total={todayTotal} tone="info" />
          <Tile index={2} icon="check" label="Tasdiqlandi" value={t.USED} total={todayTotal} tone="good" />
          <Tile index={3} icon="clock" label="Kutilmoqda" value={t.WAITING} total={todayTotal} tone="warn" />
          <Tile index={4} icon="alert" label="Yetkazilmadi" value={t.EXPIRED + t.FAILED} total={todayTotal} tone="bad" />
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
