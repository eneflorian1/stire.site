import { NavLink } from 'react-router-dom';

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15C14.4477 21 14 20.5523 14 20V15C14 14.4477 13.5523 14 13 14H11C10.4477 14 10 14.4477 10 15V20C10 20.5523 9.55228 21 9 21H4C3.44772 21 3 20.5523 3 20V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconBookmark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3H18C18.5523 3 19 3.44772 19 4V21L12 17L5 21V4C5 3.44772 5.44772 3 6 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 20C6 16.6863 8.68629 14 12 14C15.3137 14 18 16.6863 18 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navigare principală">
      <NavLink to="/" end className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}>
        <IconHome />
        <span>Home</span>
      </NavLink>
      <NavLink to="/categorii" className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}>
        <IconGrid />
        <span>Categorii</span>
      </NavLink>
      <NavLink to="/salvate" className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}>
        <IconBookmark />
        <span>Salvate</span>
      </NavLink>
      <NavLink to="/profil" className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}>
        <IconUser />
        <span>Profil</span>
      </NavLink>
    </nav>
  );
}


