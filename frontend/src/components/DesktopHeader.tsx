import { KeyboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function DesktopHeader() {
  const nav = useNavigate();
  const loc = useLocation();

  const params = new URLSearchParams(loc.search);
  const qParam = params.get('q') ?? '';

  function onSubmitSearch() {
    const next = new URLSearchParams(loc.search);
    if (qParam && qParam.trim().length > 0) next.set('q', qParam.trim());
    else next.delete('q');
    nav({ pathname: '/', search: next.toString() ? `?${next.toString()}` : '' });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onSubmitSearch();
  }

  return (
    <header className="desktop-header" role="banner">
      <div className="desktop-header__inner">
        <a className="desktop-header__brand" href="/">Stirix Admin</a>
        <div className="desktop-header__search" role="search">
          <input
            className="search-input"
            placeholder="Caută știri, categorii, topicuri..."
            defaultValue={qParam}
            onKeyDown={onKeyDown}
            aria-label="Caută"
          />
          <button className="search-btn" aria-label="Caută" onClick={onSubmitSearch}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>
        <nav className="desktop-header__actions" aria-label="Acțiuni rapide">
          <a className="desktop-link" href="/">Home</a>
          <a className="desktop-link" href="/categorii">Categorii</a>
          <a className="desktop-link" href="/admin">Admin</a>
          <a className="desktop-link" href="/profil">Profil</a>
        </nav>
      </div>
    </header>
  );
}


