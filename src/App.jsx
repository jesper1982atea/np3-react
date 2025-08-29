import React, { useEffect, useMemo, useState } from 'react'
import Home from './pages/Home'
import Daily from './pages/Daily'
import Practice from './pages/Practice'
import Exam from './pages/Exam'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Bank from './pages/Bank'
import Review from './pages/Review'

// Viktigt: din hook ligger som default-export i src/hooks/useBanks.js
import useBanks from './hooks/useBanks'

export default function App(){
  // ---- View state ----
  const [view, setView] = useState('home')

  // ---- Profil (lagra lokalt) ----
  const [profile, setProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('profile')
      return raw ? JSON.parse(raw) : { points: 0, settings: {} }
    } catch {
      return { points: 0, settings: {} }
    }
  })

  function saveProfile(next){
    setProfile(next)
    try { localStorage.setItem('profile', JSON.stringify(next)) } catch {}
  }

  // ---- Banker via hook + aktiv bank-id ----
  const { list, getBank, loading, error } = useBanks()
  const bankId = profile?.settings?.activeBankId || profile?.settings?.lastActiveBank || 'sv-ak3'
  const currentEntry = getBank(bankId) || null
  const currentBank = currentEntry?.data || null

  // Om aktiv bank-id saknas i registret: försök välja första tillgängliga
  useEffect(() => {
    if (!loading && !error) {
      const exists = list.some(b => b.id === bankId)
      if (!exists && list.length > 0) {
        const fallbackId = list[0].id
        const p = { ...profile }
        p.settings = p.settings || {}
        p.settings.activeBankId = fallbackId
        saveProfile(p)
      }
    }
  }, [loading, error, list, bankId])

  // Hjälp: uppdatera bank-id när man byter via Exam/Settings (de kan spara lastActiveBank)
  useEffect(() => {
    const last = profile?.settings?.lastActiveBank
    if (last && last !== profile?.settings?.activeBankId) {
      const p = { ...profile }
      p.settings = p.settings || {}
      p.settings.activeBankId = last
      saveProfile(p)
    }
  }, [profile?.settings?.lastActiveBank])

  // Liten bekvämlighet för att nollställa returnTo-flaggan om man byter vy manuellt
  useEffect(() => {
    try { sessionStorage.removeItem('returnTo') } catch {}
    if (typeof window !== 'undefined') window.__returnTo = undefined
  }, [view])

  return (
    <div className="container" style={{ width:'90vw', maxWidth:'1400px', margin:'0 auto' }}>
      <header>
        <div className="logo">NP3</div>
        <div className="points">
          <span>⭐</span>
          <span>{profile?.points ?? 0}</span>
        </div>
      </header>

      {/* Scrollande toppmeny (mobilvänlig) */}
      <div className="tabs-scroll desktop-only">
        <div className="tabs">
          <button className="btn small ghost" onClick={()=>setView('home')}>🏠 Start</button>
          <button className="btn small ghost" onClick={()=>setView('daily')}>⭐ Dagens</button>
          <button className="btn small ghost" onClick={()=>setView('practice')}>🧩 Öva</button>
          <button className="btn small ghost" onClick={()=>setView('exam')}>📝 Provläge</button>
          <button className="btn small ghost" onClick={()=>setView('stats')}>📊 Statistik</button>
          <button className="btn small ghost" onClick={()=>setView('settings')}>⚙️ Inställningar</button>
          <button className="btn small ghost" onClick={()=>setView('bank')}>📚 Frågebank</button>
        </div>
      </div>

      {/* Vy-innehåll */}
      {view==='home' && <Home profile={profile} setView={setView} />}

      {view==='daily' && (
        <div className="grid">
          <div className="card">
            <Daily
              profile={profile}
              saveProfile={saveProfile}
              bank={currentBank}
              setView={setView}
            />
          </div>
        </div>
      )}

      {view==='practice' && (
        <div className="grid">
          <div className="card">
            <Practice
              profile={profile}
              saveProfile={saveProfile}
              bank={currentBank}
              setView={setView}
            />
          </div>
        </div>
      )}

      {view==='exam' && (
        <div className="grid">
          <div className="card">
            <Exam
              profile={profile}
              saveProfile={saveProfile}
              bank={currentBank}
              setView={setView}
            />
          </div>
        </div>
      )}

      {view==='stats' && (
        <div className="grid">
          <div className="card">
            <Stats profile={profile} setView={setView} />
          </div>
        </div>
      )}

      {view==='settings' && (
        <div className="grid">
          <div className="card">
            <Settings
              profile={profile}
              saveProfile={saveProfile}
              setView={setView}
            />
          </div>
        </div>
      )}

      {view==='bank' && (
        <div className="grid">
          <div className="card">
            <Bank />
          </div>
        </div>
      )}

      {view==='review' && <Review setView={setView} />}
{/* 
      <nav className="bottom-nav mobile-only" role="navigation" aria-label="Primär">
        <button className={`bn-item ${view==='home'?'active':''}`} onClick={()=>setView('home')}>
          <span className="bn-ico">🏠</span>
          <span className="bn-txt">Start</span>
        </button>
        <button className={`bn-item ${view==='daily'?'active':''}`} onClick={()=>setView('daily')}>
          <span className="bn-ico">⭐</span>
          <span className="bn-txt">Dagens</span>
        </button>
        <button className={`bn-item ${view==='practice'?'active':''}`} onClick={()=>setView('practice')}>
          <span className="bn-ico">🧩</span>
          <span className="bn-txt">Öva</span>
        </button>
        <button className={`bn-item ${view==='exam'?'active':''}`} onClick={()=>setView('exam')}>
          <span className="bn-ico">📝</span>
          <span className="bn-txt">Prov</span>
        </button>
        <button className={`bn-item ${view==='stats'?'active':''}`} onClick={()=>setView('stats')}>
          <span className="bn-ico">📊</span>
          <span className="bn-txt">Stat</span>
        </button>
        <button className={`bn-item ${view==='settings'?'active':''}`} onClick={()=>setView('settings')}>
          <span className="bn-ico">⚙️</span>
          <span className="bn-txt">Inställn.</span>
        </button>
      </nav> */}

      <div className="footer">
         Data sparas lokalt i din webbläsare.
      </div>
    </div>
  )
}