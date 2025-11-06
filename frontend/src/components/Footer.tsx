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
          <a href="/" style={{ color: '#374151', textDecoration: 'none' }}>Acasă</a>
          <a href="/categorii" style={{ color: '#374151', textDecoration: 'none' }}>Categorii</a>
          <a href="/salvate" style={{ color: '#374151', textDecoration: 'none' }}>Salvate</a>
          <a href="/profil" style={{ color: '#374151', textDecoration: 'none' }}>Profil</a>
        </nav>
      </div>
    </footer>
  );
}


