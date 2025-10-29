import { KeyboardEvent } from 'react';

export default function TopBar({
  q,
  onChangeQ,
  onSubmitSearch,
  onOpenMenu,
}: {
  q: string;
  onChangeQ: (v: string) => void;
  onSubmitSearch: () => void;
  onOpenMenu: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmitSearch();
  };

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="search-wrap" role="search">
          <input
            className="search-input"
            placeholder="Caută știri"
            value={q}
            onChange={(e) => onChangeQ(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Caută știri"
          />
          <button className="search-btn" aria-label="Caută" onClick={onSubmitSearch}>
            {/* Magnifier icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>
        <button className="hamburger-btn" aria-label="Meniu" onClick={onOpenMenu}>
          {/* Hamburger icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}


