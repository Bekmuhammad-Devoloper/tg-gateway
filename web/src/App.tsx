import { useEffect, useState } from 'react';

import { api, ApiError, botName, hasSession, setSession, whenUnauthorized, type Me } from './api';
import { Contacts } from './pages/Contacts';
import { Dashboard } from './pages/Dashboard';
import { Deliveries } from './pages/Deliveries';
import { Login } from './pages/Login';
import { Projects } from './pages/Projects';
import { Settings } from './pages/Settings';
import { Icon, ProfilePhoto, Spinner, type IconName } from './ui';

const TABS: Array<{ id: string; label: string; short: string; icon: IconName; sub: string }> = [
  { id: 'home', label: 'Bosh sahifa', short: 'Bosh', icon: 'home', sub: 'Bugungi holat bir qarashda' },
  { id: 'projects', label: 'Loyihalar', short: 'Loyihalar', icon: 'projects', sub: 'API kalitlar va xabar shablonlari' },
  { id: 'contacts', label: 'Foydalanuvchilar', short: 'Odamlar', icon: 'users', sub: 'Telegram’ga ulangan raqamlar' },
  { id: 'history', label: 'Kodlar', short: 'Kodlar', icon: 'history', sub: 'Har bir so‘rov va uning holati' },
  { id: 'settings', label: 'Sozlamalar', short: 'Sozlamalar', icon: 'settings', sub: 'Bot matnlari, adminlar va API' },
];

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const today = () => { const d = new Date(); return `${d.getDate()}-${MONTHS[d.getMonth()]}`; };

const tabFromHash = (): string => {
  const id = location.hash.replace(/^#\/?/, '');
  return TABS.some(t => t.id === id) ? id : 'home';
};

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'login' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [bot, setBot] = useState('');
  const [tab, setTab] = useState(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    whenUnauthorized(() => {
      setMe(null);
      setError('Sessiya tugadi — qaytadan kiring');
      setState('login');
    });
    void (async () => {
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      const url = new URL(location.href);
      const linkToken = url.searchParams.get('login');
      try {
        if (linkToken) {
          // Botdagi /admin havolasi: bir martalik, darhol URL'dan olib tashlanadi
          url.searchParams.delete('login');
          history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
          setSession((await api.post<{ token: string }>('/auth/link', { token: linkToken })).token);
        } else if (tg?.initData) {
          setSession((await api.post<{ token: string }>('/auth/webapp', { initData: tg.initData })).token);
        }
        if (hasSession()) {
          setMe(await api.get<Me>('/me'));
          setState('ready');
          return;
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setSession('');
        setError(e instanceof Error ? e.message : 'Xatolik');
      }
      setBot(await botName());
      setState('login');
    })();
  }, []);

  const go = (id: string) => {
    location.hash = `/${id}`;
    window.scrollTo({ top: 0 });
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setSession('');
    setMe(null);
    setError('');
    setBot(await botName());
    setState('login');
  };

  if (state === 'loading') {
    return (
      <div className="center-screen">
        <Spinner />
      </div>
    );
  }
  if (state === 'login' || !me) return <Login bot={bot} error={error} />;

  const current = TABS.find(t => t.id === tab) ?? TABS[0];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="telegram" size={22} />
          </div>
          <div>
            <b>Kod shlyuzi</b>
            <span className="muted">@{me.bot}</span>
          </div>
        </div>
        <nav className="nav">
          {TABS.map(t => (
            <button key={t.id} className={`nav-item ${t.id === tab ? 'active' : ''}`} onClick={() => go(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <ProfilePhoto who="me" className="avatar" fallback={(me.name || 'A').slice(0, 1).toUpperCase()} />
            <div>
              <b>{me.name || 'Administrator'}</b>
              <span className="muted">ID {me.tgId}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="min0">
            <h1>{current.label}</h1>
            <span className="muted topbar-sub">{tab === 'home' ? `Bugun, ${today()}` : current.sub}</span>
          </div>
          <button className="me-chip" onClick={() => go('settings')} aria-label="Sozlamalar">
            <ProfilePhoto who="me" className="me-avatar" fallback={(me.name || 'A').slice(0, 1).toUpperCase()} />
          </button>
        </header>
        <div className="content page" key={tab}>
          {tab === 'home' && <Dashboard me={me} onGo={go} />}
          {tab === 'projects' && <Projects />}
          {tab === 'contacts' && <Contacts />}
          {tab === 'history' && <Deliveries />}
          {tab === 'settings' && <Settings me={me} onLogout={logout} />}
        </div>
      </main>

      <nav className="tabbar" aria-label="Bo‘limlar">
        {TABS.map(t => (
          <button key={t.id} className={`tab ${t.id === tab ? 'active' : ''}`} onClick={() => go(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
            <span className="tab-icon">
              <Icon name={t.icon} size={21} />
            </span>
            <span>{t.short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
