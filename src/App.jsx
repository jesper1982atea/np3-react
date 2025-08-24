// src/lib/session.js
// Minimal sessions-logg för Daily/Practice/Exam
// Sparar per-fråga-val och resultat. Visas i pages/Review.

const KEY = 'np3_sessions_v1'

function loadAll(){
  try{ return JSON.parse(localStorage.getItem(KEY) || '[]') }catch(_){ return [] }
}
function saveAll(arr){
  try{ localStorage.setItem(KEY, JSON.stringify(arr.slice(-50))) }catch(_){ /* ignore */ }
}

export function beginSession(type, meta={}){
  const id = `${type}-${Date.now()}`
  const session = {
    id,
    type, // 'daily' | 'practice' | 'exam'
    startedAt: new Date().toISOString(),
    finishedAt: null,
    meta: meta || {}, // t.ex. {subject, bankId, label, count}
    items: [] // { id, q, options, correct, chosen, isCorrect, area, title?, text? }
  }
  return session
}

export function logAnswer(session, q, chosenIdx){
  if(!session || !q) return
  const isCorrect = (chosenIdx === q.correct)
  session.items.push({
    id: q.id,
    q: q.q,
    options: q.options,
    correct: q.correct,
    chosen: chosenIdx,
    isCorrect,
    area: q.area || 'okänd',
    title: q.title || null,
    text: q.text || null,
    hint: q.hint || null,
    type: q.type || 'mc'
  })
}

export function endSession(session){
  if(!session) return null
  session.finishedAt = new Date().toISOString()
  const all = loadAll()
  all.push(session)
  saveAll(all)
  return session
}

export function getSessions(){
  return loadAll()
}

export function getLastSession(){
  const all = loadAll()
  return all.length ? all[all.length-1] : null
}

export function clearSessions(){
  saveAll([])
}

import { useState } from 'react'
import './styles.css'
import useBanks from './hooks/useBank' // fallback-aware hook (legacy or index.json)
import { loadProfile, saveProfile as persist } from './lib/storage'

// pages
import Home from './pages/Home'
import Practice from './pages/Practice'
import Exam from './pages/Exam'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Bank from './pages/Bank'
import Review from './pages/Review'
import Daily from './pages/Daily'

export default function App(){
  const { getBank, loading, error } = useBanks()
  const [view, setView] = useState('home')
  const [profile, setProfile] = useState(loadProfile())

  const saveProfile = (p) => { setProfile(p); persist(p) }

  if(loading) return <div className="container"><div className="card">⏳ Laddar banker…</div></div>
  if(error) return <div className="container"><div className="card">⚠️ Kunde inte ladda banker.</div></div>

  // Aktiv bank-id hämtas alltid från profilinställningar (sätts i Settings)
  const bankId = profile?.settings?.activeBankId || 'sv-ak3'
  const currentEntry = getBank(bankId) || null
  const currentBank = currentEntry?.data || null

  return (
    <div className="container">
      <header>
        <div className="logo">📚 Träning &amp; Prov – ämnen &amp; årskurser</div>
        <div className="points">
          <span>Lv {profile.level}</span>
          <span>⭐ {profile.points}</span>
        </div>
      </header>

      <div className="tabs">
        <button className="btn small ghost" onClick={()=>setView('home')}>🏠 Start</button>
        <button className="btn small ghost" onClick={()=>setView('daily')}>⭐ Dagens</button>
        <button className="btn small ghost" onClick={()=>setView('practice')}>🧩 Öva</button>
        <button className="btn small ghost" onClick={()=>setView('exam')}>📝 Provläge</button>
        <button className="btn small ghost" onClick={()=>setView('stats')}>📊 Statistik</button>
        <button className="btn small ghost" onClick={()=>setView('settings')}>⚙️ Inställningar</button>
        <button className="btn small ghost" onClick={()=>setView('bank')}>📚 Frågebank</button>
      </div>

      {view==='home' && <Home profile={profile} setView={setView} />}
      {view==='daily' && <Daily profile={profile} saveProfile={saveProfile} bank={currentBank} setView={setView} />}
      {view==='practice' && <Practice profile={profile} saveProfile={saveProfile} bank={currentBank} setView={setView} />}
      {view==='exam' && <Exam profile={profile} saveProfile={saveProfile} bank={currentBank} setView={setView} />}
      {view==='stats' && <Stats profile={profile} setView={setView} />}
      {view==='settings' && <Settings profile={profile} saveProfile={saveProfile} setView={setView} />}
      {view==='bank' && <Bank />}
      {view==='review' && <Review setView={setView} />}

      <div className="footer">Prototyp. Data sparas lokalt i din webbläsare.</div>
    </div>
  )
}