import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Home from './pages/Home';
import ArticlePage from './pages/Article';
import CreateArticle from './pages/CreateArticle';
import Admin from './pages/Admin';
import Categories from './pages/Categories';
import Saved from './pages/Saved';
import Profile from './pages/Profile';
import TopBar from './components/TopBar';
import HamburgerMenu from './components/HamburgerMenu';
import BottomNav from './components/BottomNav';

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const [w, setW] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [q, setQ] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sync search with URL ?q=
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    setQ(params.get('q') ?? '');
  }, [loc.search]);

  const doSearch = useMemo(() => (
    () => {
      const params = new URLSearchParams(loc.search);
      if (q && q.trim().length > 0) params.set('q', q.trim());
      else params.delete('q');
      nav({ pathname: '/', search: params.toString() ? `?${params.toString()}` : '' });
    }
  ), [q, loc.search, nav]);

  // Mobile and desktop now share the same responsive UI; no iframe redirect

  return (
    <div>
      <TopBar
        q={q}
        onChangeQ={setQ}
        onSubmitSearch={doSearch}
        onOpenMenu={() => setMenuOpen(true)}
      />
      <HamburgerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main style={{ paddingTop: 56, paddingBottom: 72 }}>
        <Routes location={loc}>
          <Route path="/" element={<Home />} />
          <Route path="/article/:id" element={<ArticlePage />} />
          <Route path="/create" element={<CreateArticle />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/categorii" element={<Categories />} />
          <Route path="/salvate" element={<Saved />} />
          <Route path="/profil" element={<Profile />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}


