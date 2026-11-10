import { useEffect, useState } from 'react';

import { api, type Stats } from '../api';
import { errorText, Icon, Spinner, type IconName } from '../ui';

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
                className={`col ${active === i ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(active === i ? null : i)}
                aria-label={`${d.day}: yetkazildi ${d.sent}, yetkazilmadi ${d.waiting}`}
              >
                <div className="stack" style={{ height: `${(sum / top) * 100}%` }}>
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
        {days.map(d => (
          <span key={d.day}>{WEEKDAYS[new Date(`${d.day}T00:00:00`).getDay()]}</span>
        ))}
      </div>
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: IconName; label: string; value: number; tone: string }) {
  return (
    <div className="tile">
      <div className={`tile-icon ${tone}`}>
        <Icon name={icon} size={18} />
      </div>
      <span className="tile-value">{value.toLocaleString('ru-RU')}</span>
      <span className="muted">{label}</span>
    </div>
  );
}

export function Dashboard({ onGo }: { onGo: (tab: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () =>
      api
        .get<Stats>('/stats')
        .then(s => {
          setStats(s);
          setError('');
        })
        .catch(e => setError(errorText(e)));
    void load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  if (error && !stats) return <div className="alert bad">{error}</div>;
  if (!stats) return <Spinner />;
  const t = stats.today;

  return (
    <div className="stack-lg">
      <section>
        <h2 className="section-title">Bugun</h2>
        <div className="tiles">
          <Tile icon="send" label="Yetkazildi" value={t.SENT + t.USED} tone="info" />
          <Tile icon="check" label="Tasdiqlandi" value={t.USED} tone="good" />
          <Tile icon="clock" label="Kutilmoqda" value={t.WAITING} tone="warn" />
          <Tile icon="alert" label="Yetkazilmadi" value={t.EXPIRED + t.FAILED} tone="bad" />
        </div>
      </section>

      <section className="card">
        <WeekChart days={stats.days} />
      </section>

      <section className="tiles two">
        <button className="card link-card" onClick={() => onGo('projects')}>
          <Icon name="projects" />
          <div>
            <b>{stats.projects} ta loyiha</b>
            <span className="muted">API kalitlar va xabar shablonlari</span>
          </div>
        </button>
        <button className="card link-card" onClick={() => onGo('contacts')}>
          <Icon name="users" />
          <div>
            <b>{stats.contacts} ta foydalanuvchi</b>
            <span className="muted">Telegram’ga ulangan raqamlar</span>
          </div>
        </button>
      </section>

      {stats.projects === 0 && (
        <section className="card how">
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
