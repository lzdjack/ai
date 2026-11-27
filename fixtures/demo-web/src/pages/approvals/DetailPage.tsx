import { useEffect, useState } from 'react';
import { StatusTag, formatAmount, formatDateTime } from '@demo/lib';
import { api } from '../../api';
import { CURRENT_USER } from '../../auth/current-user';
import { canWithdraw } from '../../auth/permissions';
import { useI18n } from '../../i18n';
import type { Approval } from '../../types';
import { FlowNodes } from './FlowNodes';

export function DetailPage({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const [item, setItem] = useState<Approval | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(id).then(setItem, () => setError(true));
  }, [id]);

  if (error) return <p>{t('common.error')}</p>;
  if (!item) return <p>{t('common.loading')}</p>;

  const withdraw = () => api.withdraw(item.id).then(setItem, () => setError(true));

  return (
    <section>
      <a href="#/approvals">{t('detail.back')}</a>
      <h2>
        {item.title} <StatusTag status={item.status} locale={locale} />
      </h2>
      <dl>
        <dt>{t('list.col.applicant')}</dt>
        <dd>{item.applicant_name}</dd>
        <dt>{t('list.col.amount')}</dt>
        <dd>{formatAmount(item.amount, locale)}</dd>
        <dt>{t('list.col.submitted_at')}</dt>
        <dd>{formatDateTime(item.submitted_at, locale)}</dd>
        <dt>{t('detail.reason')}</dt>
        <dd>{item.reason}</dd>
      </dl>
      <h3>{t('detail.flow')}</h3>
      <FlowNodes nodes={item.nodes} />
      {canWithdraw(CURRENT_USER, item) && <button onClick={withdraw}>{t('detail.withdraw')}</button>}
    </section>
  );
}
