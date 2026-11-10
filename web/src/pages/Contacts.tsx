import { useEffect, useState } from 'react';

import { api, type Contact } from '../api';
import { Empty, errorText, fmtAgo, fmtDate, Icon, Pager, Spinner, useUi } from '../ui';

export function Contacts() {
  const { toast, confirm } = useUi();
  const [items, setItems] = useState<Contact[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  // Qidiruv yozib bo'lingach (300 ms) so'raladi
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = () =>
    api
      .page<Contact[]>(`/contacts?page=${page}&search=${encodeURIComponent(query)}`)
      .then(r => {
        setItems(r.data);
        setTotal(r.meta?.total ?? 0);
        setError('');
      })
      .catch(e => setError(errorText(e)));
  useEffect(() => void load(), [page, query]);

  const block = async (c: Contact) => {
    if (!c.blocked) {
      const ok = await confirm({ title: 'Bloklash', text: `${c.phone} raqamiga kodlar yuborilmaydi (barcha loyihalar uchun).`, action: 'Bloklash', danger: true });
      if (!ok) return;
    }
    try {
      await api.patch(`/contacts/${c.tgId}`, { blocked: !c.blocked });
      toast(c.blocked ? 'Blokdan chiqarildi' : 'Bloklandi');
      void load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  const unlink = async (c: Contact) => {
    const ok = await confirm({ title: 'Raqamni uzish', text: `${c.phone} Telegram’dan uziladi. Keyingi safar foydalanuvchi raqamini qayta yuboradi.`, action: 'Uzish', danger: true });
    if (!ok) return;
    try {
      await api.del(`/contacts/${c.tgId}`);
      toast('Uzildi');
      void load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <div className="stack-lg">
      <div className="search">
        <Icon name="search" size={18} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Telefon, ism yoki @username" aria-label="Qidirish" />
        <span className="muted">{total} ta</span>
      </div>

      {error && <div className="alert bad">{error}</div>}
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="card">
          <Empty icon="users" title={query ? 'Topilmadi' : 'Hali hech kim ulanmagan'} text={query ? undefined : 'Foydalanuvchi botda raqamini yuborgach shu yerda ko‘rinadi.'} />
        </div>
      ) : (
        <div className="card list">
          {items.map(c => (
            <div key={c.tgId} className={`list-row ${c.blocked ? 'off' : ''}`}>
              <div className="avatar">{(c.firstName || c.phone).slice(0, 1).toUpperCase()}</div>
              <div className="grow min0">
                <div className="row-title">
                  <b>{c.firstName || 'Nomsiz'}</b>
                  {c.username && <span className="muted">@{c.username}</span>}
                  {c.blocked && (
                    <span className="badge bad">
                      <Icon name="ban" size={13} />
                      Bloklangan
                    </span>
                  )}
                </div>
                <div className="row-sub">
                  <span className="mono">{c.phone}</span>
                  <span className="muted">Ulangan: {fmtDate(c.linkedAt)}</span>
                  <span className="muted">Oxirgi kod: {fmtAgo(c.lastCodeAt)}</span>
                </div>
              </div>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => block(c)} title={c.blocked ? 'Blokdan chiqarish' : 'Bloklash'} aria-label={c.blocked ? 'Blokdan chiqarish' : 'Bloklash'}>
                  <Icon name={c.blocked ? 'check' : 'ban'} size={18} />
                </button>
                <button className="icon-btn danger-text" onClick={() => unlink(c)} title="Uzish" aria-label="Uzish">
                  <Icon name="unlink" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
    </div>
  );
}
