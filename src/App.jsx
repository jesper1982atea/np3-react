// src/App.jsx
import { useState, useMemo } from 'react'
import './styles.css'
import useBank from './hooks/useBank'
import { loadProfile, saveProfile as persist } from './lib/storage'

// pages
import Home from './pages/Home'
import Practice from './pages/Practice'
import Exam from './pages/Exam'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Bank from './pages/Bank'
import Review from './pages/Review'

// error boundary
import ErrorBoundary from './components/ErrorBoundary'

export default function App(){
  const { bank, loading, error } = useBank()
  const [view, setView] = useState('home')
  const [profile, setProfile] = useState(loadProfile())

  const saveProfile = (p) => { setProfile(p); persist(p) }

  const Tab = ({ id, children }) => {
    const active = view === id
    return (
      <button
        className={`btn small ghost${active ? ' alt' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={()=>setView(id)}
      >
        {children}
      </button>
    )
  }

  // pre-render main content (inside ErrorBoundary) so header/tabs alltid syns
  const mainContent = useMemo(()=>{
    if(loading) return <div className="card">⏳ Laddar frågebank…</div>
    if(error)   return <div className="card">⚠️ Kunde inte ladda frågebank.</div>

    return (
      <>
        {view==='home' && <Home profile={profile} setView={setView} />}
        {view==='practice' && <Practice profile={profile} saveProfile={saveProfile} bank={bank} setView={setView} />}
        {view==='exam' && <Exam profile={profile} saveProfile={saveProfile} bank={bank} setView={setView} />}
        {view==='stats' && <Stats profile={profile} setView={setView} />}
        {view==='settings' && <Settings profile={profile} saveProfile={saveProfile} setView={setView} />}
        {view==='bank' && <Bank />}
        {view==='review' && <Review setView={setView} />}
      </>
    )
  }, [view, loading, error, bank, profile])

  return (
    <div className="container">
      <header>
        <div className="logo">📚 Nationella prov åk 3 – Träning & Prov</div>
        <div className="points">
          <span>Lv {profile.level}</span>
          <span>⭐ {profile.points}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Huvudnavigering">
        <Tab id="home">🏠 Startsida</Tab>
        <Tab id="practice">🧩 Öva</Tab>
        <Tab id="exam">📝 Provläge</Tab>
        <Tab id="stats">📊 Statistik</Tab>
        <Tab id="settings">⚙️ Inställningar</Tab>
        <Tab id="bank">📚 Frågebank</Tab>
      </nav>

      {/* Allt innehåll wrappas i ErrorBoundary – om något smäller visas en snäll fallback */}
      <ErrorBoundary>
        {mainContent}
      </ErrorBoundary>

      <div className="footer">Prototyp. Data sparas lokalt i din webbläsare.</div>
    </div>
  )
}