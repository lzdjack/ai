import { useEffect, useMemo, useState } from 'react';
import { StatusTag, formatAmount, formatDateTime, statusMeta } from '@demo/lib';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import type { Approval } from '../../types';
import { STATUS_FILTER_OPTIONS, filterApprovals, type StatusFilter } from './filter';
import { paginate } from './pagination';
import { sortApprovals, type SortKey, type SortOrder } from './sort';

const PAGE_SIZE = 10;

export function ListPage() {
  const { t, locale } = useI18n();
  const [all, setAll] = useState<Approval[] | null>(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder }>({ key: 'submitted_at', order: 'desc' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.list().then(setAll, () => setError(true));
  }, []);

  const view = useMemo(() => {
    const filtered = filterApprovals(all ?? [], { status, keyword });
    return paginate(sortApprovals(filtered, sort.key, sort.order), page, PAGE_SIZE);
  }, [all, status, keyword, sort, page]);

  if (error) return <p>{t('common.error')}</p>;
  if (!all) return <p>{t('common.loading')}</p>;

  const toggleSort = (key: SortKey) => {
    setSort((s) => ({ key, order: s.key === key && s.order === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };
  const arrow = (key: SortKey) => (sort.key === key ? (sort.order === 'desc' ? ' ↓' : ' ↑') : '');

  return (
    <section>
      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
        >
          {STATUS_FILTER_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? t('list.status.all') : statusMeta(s, locale).label}
            </option>
          ))}
        </select>
        <input
          placeholder={t('list.keyword')}
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>{t('list.col.title')}</th>
            <th>{t('list.col.applicant')}</th>
            <th className="sortable" onClick={() => toggleSort('amount')}>
              {t('list.col.amount')}
              {arrow('amount')}
            </th>
            <th>{t('list.col.status')}</th>
            <th className="sortable" onClick={() => toggleSort('submitted_at')}>
              {t('list.col.submitted_at')}
              {arrow('submitted_at')}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.items.map((a) => (
            <tr key={a.id}>
              <td>
                <a href={`#/approvals/${a.id}`}>{a.title}</a>
              </td>
              <td>{a.applicant_name}</td>
              <td className="num">{formatAmount(a.amount, locale)}</td>
              <td>
                <StatusTag status={a.status} locale={locale} />
              </td>
              <td>{formatDateTime(a.submitted_at, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {view.total === 0 && <p className="muted">{t('list.empty')}</p>}
      <div className="pager">
        <button disabled={view.page <= 1} onClick={() => setPage(view.page - 1)}>
          {t('list.prev')}
        </button>
        <span>{t('list.page', { page: view.page, pages: view.pages, total: view.total })}</span>
        <button disabled={view.page >= view.pages} onClick={() => setPage(view.page + 1)}>
          {t('list.next')}
        </button>
      </div>
    </section>
  );
}
