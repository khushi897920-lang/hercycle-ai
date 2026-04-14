export default function Navbar({ activeNav, setActiveNav, activeLang, setActiveLang }) {
  return (
    <nav className="glass">
      <div className="logo">
        Her<em>Cycle</em><span className="logo-dot"> AI</span> 🌸
      </div>
      <ul>
        {['Dashboard', 'Track', 'Insights', 'Chat'].map((item) => (
          <li key={item}>
            <a
              href="#"
              className={activeNav === item ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); setActiveNav(item); }}
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
      <div className="nav-right">
        <div className="lang-toggle">
          <button
            className={`lang-btn ${activeLang === 'EN' ? 'active' : ''}`}
            onClick={() => setActiveLang('EN')}
          >
            EN
          </button>
          <button
            className={`lang-btn ${activeLang === 'हि' ? 'active' : ''}`}
            onClick={() => setActiveLang('हि')}
          >
            हि
          </button>
        </div>
        <button className="btn-pill">Log Today 💕</button>
      </div>
    </nav>
  );
}
