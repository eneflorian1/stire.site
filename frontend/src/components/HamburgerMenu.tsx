import { Link } from 'react-router-dom';

export default function HamburgerMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Meniu">
        <div className="drawer-header">
          <button className="drawer-close" onClick={onClose} aria-label="Închide">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <nav className="drawer-nav">
          <Link to="/admin" className="drawer-link" onClick={onClose}>Admin dashboard</Link>
          <Link to="/create" className="drawer-link" onClick={onClose}>Creează</Link>
        </nav>
      </aside>
    </>
  );
}


