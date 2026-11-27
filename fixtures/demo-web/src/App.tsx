import { useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { DetailPage } from './pages/approvals/DetailPage';
import { ListPage } from './pages/approvals/ListPage';
import { NewPage } from './pages/approvals/NewPage';

function useHash() {
  const [hash, setHash] = useState(location.hash || '#/approvals');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/approvals');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function App() {
  const { t, locale, setLocale } = useI18n();
  const hash = useHash();
  const detail = /^#\/approvals\/(A\d+)$/.exec(hash);

  return (
    <div className="app">
      <header>
        <h1>{t('app.title')}</h1>
        <nav>
          <a href="#/approvals">{t('nav.list')}</a>
          <a href="#/approvals/new">{t('nav.new')}</a>
          <button onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
            {locale === 'zh-CN' ? 'English' : '中文'}
          </button>
        </nav>
      </header>
      <main>{hash === '#/approvals/new' ? <NewPage /> : detail ? <DetailPage id={detail[1]!} /> : <ListPage />}</main>
    </div>
  );
}
