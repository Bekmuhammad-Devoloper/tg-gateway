import { useEffect, useState } from 'react';

import { api, type DeliveryRow, type DeliveryStatus, type Project } from '../api';
import { Empty, errorText, fmtDate, Icon, Pager, Spinner, StatusBadge, statusLabel } from '../ui';

const STATUSES: DeliveryStatus[] = ['SENT', 'USED', 'WAITING', 'EXPIRED', 'FAILED'];

export function Deliveries() {
  const [items, setItems] = useState<DeliveryRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => {});
  }, []);

  const load = async () => {
    setBusy(true);
    try {
      const r = await api.page<DeliveryRow[]>(`/deliveries?page=${page}&projectId=${projectId}&status=${status}`);
      setItems(r.data);
      setTotal(r.meta?.total ?? 0);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [page, projectId, status]);

  return (
    <div className="stack-lg">
      <div className="filters">
        <select value={projectId} onChange={e => (setProjectId(e.target.value), setPage(1))} aria-label="Loyiha">
          <option value="">Barcha loyihalar</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={e => (setStatus(e.target.value), setPage(1))} aria-label="Holat">
          <option value="">Barcha holatlar</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <button className="icon-btn" onClick={() => void load()} aria-label="Yangilash" disabled={busy}>
          <span className={busy ? 'spin' : ''}>
            <Icon name="refresh" size={18} />
          </span>
        </button>
      </div>

      {error && <div className="alert bad">{error}</div>}
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="card">
          <Empty icon="history" title="Kodlar yo‘q" text="Loyihalar kod so‘raganda shu yerda ko‘rinadi. Kodlarning o‘zi saqlanmaydi." />
        </div>
      ) : (
        <div className="card list">
          {items.map(d => (
            <div key={d.id} className="list-row">
              <div className="grow min0">
                <div className="row-title">
                  <b>{d.project}</b>
                </div>
                <div className="row-sub">
                  <span className="mono">{d.phone}</span>
                  <span className="muted">{fmtDate(d.createdAt)}</span>
                  <span className="muted">{d.mode === 'VERIFY' ? 'Shlyuz kodi' : 'Loyiha kodi'}</span>
                  {d.attempts > 0 && <span className="muted">{d.attempts} urinish</span>}
                </div>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
      <p className="hint">
        <Icon name="lock" size={14} /> Kodlarning o‘zi panelda ko‘rsatilmaydi va muddati o‘tgach bazadan o‘chiriladi.
      </p>
    </div>
  );
}
