import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid #e5e7eb',
      padding: '24px 0',
      marginTop: 24,
      background: '#fff'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ color: '#6b7280' }}>© {new Date().getFullYear()} Stirix</div>
        <nav style={{ display: 'flex', gap: 16 }}>
          <Link to="/" style={{ color: '#374151', textDecoration: 'none' }}>Acasă</Link>
          <Link to="/categorii" style={{ color: '#374151', textDecoration: 'none' }}>Categorii</Link>
          <Link to="/salvate" style={{ color: '#374151', textDecoration: 'none' }}>Salvate</Link>
          <Link to="/profil" style={{ color: '#374151', textDecoration: 'none' }}>Profil</Link>
        </nav>
      </div>
    </footer>
  );
}


