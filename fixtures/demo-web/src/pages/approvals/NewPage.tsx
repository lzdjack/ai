import { useState, type FormEvent } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { validateApproval, type FormErrors } from './validate';

export function NewPage() {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = { title, amount: amount === '' ? Number.NaN : Number(amount), reason };
    const found = validateApproval(value);
    setErrors(found);
    if (Object.keys(found).length) return;
    const created = await api.create(value);
    location.hash = `#/approvals/${created.id}`;
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label>
        {t('form.title')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        {errors.title && <span className="error">{t(errors.title)}</span>}
      </label>
      <label>
        {t('form.amount')}
        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {errors.amount && <span className="error">{t(errors.amount)}</span>}
      </label>
      <label>
        {t('form.reason')}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        {errors.reason && <span className="error">{t(errors.reason)}</span>}
      </label>
      <button type="submit">{t('form.submit')}</button>
    </form>
  );
}
