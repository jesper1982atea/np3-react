// src/pages/Practice.jsx
import { useEffect, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import TableFillCard from '../components/TableFillCard'
import PieAssignCard from '../components/PieAssignCard'
import ChanceMatrixCard from '../components/ChanceMatrixCard'
import { drawSmart, shuffle } from '../lib/draw'
import { rollingAccuracy, decideDifficulty, filterByDifficulty } from '../lib/difficulty'

const FALLBACK_EXPLAINS = {
  stavning: "Stavning: Välj den korrekta stavningen. Jämför bokstäver och ljud – särskilt sj-, tj-, hj-, lj-, skj-.",
  grammatik: "Grammatik: Substantiv = namn på saker/djur/personer/platser. Verb = något man gör. Adjektiv = beskriver egenskaper.",
  ordforstaelse: "Ordförståelse: Synonym betyder liknande ord. Motsats betyder tvärtom.",
  'läsförståelse': "Läsförståelse: Leta efter stöd i texten. Svaret står ofta tydligt uttryckt.",
  matematik: "Matematik: Följ räknesättets regler och tänk steg för steg (tiotal/ental)."
}

// Bygger en lösningsstrategi för matte utan att avslöja svaret – med små "bilder"
function buildMathStrategy(q){
  const txt = (q?.q || '').toLowerCase()
  const area = (q?.area || 'matematik').toLowerCase()
  const nums = (txt.match(/-?\d+/g) || []).map(n => parseInt(n,10))
  const [a,b] = nums

  const hoppar = (start, steg, antal) => {
    let out = `${start}`, cur = start
    for(let i=0;i<Math.max(0,antal);i++){ cur += steg; out += ` ──➜ ${cur}` }
    return out
  }
  const tallinje = (start, slut, steg) => {
    if(!steg) steg = 1
    const asc = start <= slut, dir = asc ? 1 : -1
    let cur = start, pts = [cur], guard = 12
    while((asc && cur < slut) || (!asc && cur > slut)){
      cur += dir * Math.abs(steg); pts.push(cur); if(--guard<=0) break
    }
    return pts.join('  →  ')
  }

  if(area.includes('addition')){
    if(nums.length>=2){
      const big = Math.max(a,b), small = Math.min(a,b)
      const tillTio = (10 - (big % 10)) % 10
      if(tillTio && tillTio <= small){
        return `🎯 Gör en tia:
• ${big} + ${tillTio} = ${big + tillTio} (jämn tia)
• Lägg på resten: ${small - tillTio}
🧠 Huvudräkning blir lätt med 10/20/30.

` + hoppar(big, tillTio, 1) + ` ──➜ ${big + tillTio}  … + ${small - tillTio}`
      }
      return `🎯 Räkna från det större talet:
• Börja på ${big} och "hoppa" ${small} steg (t.ex. 5-steg + 1-steg).
` + hoppar(big, 1, Math.min(small,5)) + (small>5?' …':'')
    }
    return `🎯 Gör hela tiotal först. Sikta på 10/20/30 och lägg på resten.`
  }

  if(area.includes('subtraktion')){
    if(nums.length>=2){
      const from = a, take = b, nerTillTia = from % 10
      if(nerTillTia && (take > nerTillTia)){
        return `🎯 Dela upp borttag till närmaste tia:
• ${from} → ${from - nerTillTia} (ner ${nerTillTia} till jämn tia)
• Ta resten: ${take - nerTillTia}
` + tallinje(from, from - take, nerTillTia) + (take - nerTillTia ? `  →  ${from - take}` : '')
      }
      return `🎯 Räkna upp: börja vid ${from - take} och hoppa till ${from}.
• Summan av hoppen = skillnaden.
` + tallinje(from - take, from, 1)
    }
    return `🎯 Ner till jämn tia först, eller "räkna upp" från det mindre till det större.`
  }

  if(area.includes('multiplikation')){
    if(nums.length>=2){
      if(a===9||b===9){
        const n = a===9?b:a
        return `🎯 9-knepet: 10×${n} − ${n}
• 10×${n} = ${10*n}
• ${10*n} − ${n} = …`
      }
      if(a===4||b===4){
        const n = a===4?b:a
        return `🎯 Dubbla-dubbla (4×${n}):
• Dubbla ${n} → ${n*2}
• Dubbla igen → …`
      }
      if(a===8||b===8){
        const n = a===8?b:a
        return `🎯 Dubbla tre gånger (8×${n}):
• ${n} → ${n*2} → ${n*4} → …`
      }
      if(a===5||b===5){
        const n = a===5?b:a
        return `🎯 5-steg:
• Räkna ${n} femmor: 5, 10, 15, …
` + hoppar(0,5,Math.min(n,6)) + (n>6?' …':'')
      }
      return `🎯 Bryt upp: n×m = n×(m−1) + n. Använd ×10 eller ×5 som ankare och justera.`
    }
    return `🎯 Upprepad addition eller bryt mot 10: n×m = n×10 − n×(10−m).`
  }

  if(area.includes('division')){
    if(nums.length>=2 && b){
      return `🎯 Multiplikation baklänges:
• Hur många ${b}:or ryms i ${a}?
• Sök i ${b}-tabellen nära ${a} och justera.
` + tallinje(0, a, b)
    }
    return `🎯 “Hur många grupper?” Använd en tabell du kan och närma dig.`
  }

  if(area.includes('taluppfattning')){
    if(txt.includes('tiotal') && a!=null){
      return `🎯 Dela upp i tiotal och ental:
• ${a} = ${Math.floor(a/10)} tiotal och ${a%10} ental.`
    }
    if(txt.includes('störst')) return `🎯 Jämför först tiotal. Om lika – jämför ental.`
    return `🎯 Dela upp tal i tiotal/ental. Resonera på tiotal först.`
  }

  if(area.includes('klock') || txt.includes('halv') || txt.includes('kvart')){
    if(txt.includes('halv')) return `🎯 “Halv tre” = 30 min innan tre → den har passerat två: …:30. (Förmiddag 02:30 / Eftermiddag 14:30)`
    if(txt.includes('kvart')) return `🎯 Kvart = 15 min. “Kvart över X” = X:15. “Kvart i X” = (X−1):45.`
    return `🎯 Tänk i 60 minuter/varv. Halv = :30, kvart = :15 eller :45.`
  }

  if(area.includes('mätning')) return `🎯 Prefix: 1 m = 100 cm, 1 km = 1000 m, 1 kg = 1000 g. Flytta decimalen enligt prefixet.`
  if(area.includes('geometri')){
    if(txt.includes('hörn')) return `🎯 Räkna hörnen ett i taget. Kvadrat har 4 hörn och 4 lika sidor.`
    return `🎯 Titta på antal sidor/hörn och om sidorna är lika långa.`
  }
  if(area.includes('problem') || txt.includes('har ') || txt.includes('får ')){
    return `🎯 Skriv en mini-ekvation: start ± förändring = svar. Rita hoppen på tallinjen i huvudet (upp vid +, ner vid −).`
  }

  return `🎯 Dela upp i enkla steg: sikta på 10/100, använd dubbla/halvera, kontrollera rimlighet med överslag.`
}

function buildFallbackExplain(q){
  if(q?.explain) return q.explain
  if(q?.topic === 'matematik') return buildMathStrategy(q)
  const text = (q?.q || '').toLowerCase()
  const area = q?.area || (q?.topic === 'svenska' ? (q?.title ? 'läsförståelse' : 'grammatik') : 'matematik')

  if(area === 'grammatik'){
    if(text.includes('substantiv')) return "Substantiv är namn på saker, djur, personer eller platser (t.ex. 'katt', 'bord', 'Lisa')."
    if(text.includes('verb')) return "Verb beskriver handling eller tillstånd (t.ex. 'springer', 'läser', 'är')."
    if(text.includes('adjektiv')) return "Adjektiv beskriver egenskaper (t.ex. 'stor', 'röd', 'snabb')."
    if(text.includes('pronomen')) return "Pronomen ersätter substantiv (t.ex. 'han', 'hon', 'den', 'det')."
    if(text.includes('preposition')) return "Prepositioner beskriver läge/riktning (t.ex. 'på', 'under', 'i', 'bakom')."
    if(text.includes('preteritum') || text.includes('tempus')) return "Preteritum = dåtid (igår). Ex: läser→läste, skriver→skrev."
    return FALLBACK_EXPLAINS.grammatik
  }
  if(area === 'stavning') return FALLBACK_EXPLAINS.stavning
  if(area === 'ordforstaelse') return FALLBACK_EXPLARLSE
  if(area === 'läsförståelse') return FALLBACK_EXPLAINS['läsförståelse']
  if(q?.topic === 'matematik') return buildMathStrategy(q)
  return FALLBACK_EXPLAINS.grammatik
}

// Kort, “uppslagsboks-lik” hjälptext som visas när man klickar 🆘 Hjälp
function buildConceptHint(q){
  if(q?.hint) return q.hint
  if(q?.topic === 'matematik') return buildMathStrategy(q)
  const t = (q?.q || '').toLowerCase()
  const area = q?.area || (q?.topic === 'svenska' ? (q?.title ? 'läsförståelse' : 'grammatik') : 'matematik')
  if(area === 'grammatik'){
    if(t.includes('substantiv')) return "Substantiv: namn på saker/djur/personer/platser. Ex: katt, bok, Lisa."
    if(t.includes('verb')) return "Verb: något man gör eller är. Ex: springer, läser, är."
    if(t.includes('adjektiv')) return "Adjektiv: beskriver egenskaper. Ex: stor, röd, snabb."
    if(t.includes('pronomen')) return "Pronomen: ersätter substantiv. Ex: han, hon, den, det."
    if(t.includes('preposition')) return "Preposition: läge/riktning. Ex: på, i, under, bakom."
    if(t.includes('mening')) return "Mening: stor bokstav i början och punkt/!? på slutet."
    if(t.includes('ordföljd')) return "Ordföljd: T.ex. 'Igår åt jag glass.' (tid) + subjekt + verb + objekt."
    if(t.includes('kongruens')) return "Kongruens: ord ska passa ihop i form. 'Den stora katten…' (bestämd form)."
    if(t.includes('preteritum') || t.includes('tempus')) return "Preteritum = dåtid: läser→läste, skriver→skrev, är→var."
    return "Grammatik: Substantiv (namn), verb (handling), adjektiv (beskriver)."
  }
  if(area === 'stavning') return "Titta noga på bokstäverna. Ljud som sj-, tj-, hj-, lj-, skj- är vanliga fällor."
  if(area === 'ordforstaelse') return "Synonym = liknande ord. Motsats = tvärtom. Välj det som passar bäst i meningen."
  if(area === 'läsförståelse') return "Läs en gång till. Leta efter ord i texten som matchar frågan ordagrant."
  if(q?.topic === 'matematik') return buildMathStrategy(q)
  return "Fundera på vad frågan egentligen frågar efter och jämför alternativen."
}

export default function Practice({ profile, saveProfile, bank, setView }){
  const [topic, setTopic] = useState('svenska') // 'svenska' | 'matematik'
  const [setQ, setSetQ] = useState([])
  const [idx, setIdx] = useState(0)
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'review' | 'done'
  const [remaining, setRemaining] = useState(profile?.settings?.perQuestionTimerSec || 45)
  const [last, setLast] = useState({correct:null, explain:''})
  const [showHelp, setShowHelp] = useState(false)
  const timerRef = useRef(null)

  const perQuiz = profile?.settings?.perQuiz || 10
  const perQSec = profile?.settings?.perQuestionTimerSec || 45
  const noRepeats = profile?.settings?.noRepeats !== false

  // Adaptiva parametrar
  const baseMode = profile?.settings?.difficultyMode || 'np'
  const adaptive = !!profile?.settings?.adaptiveDifficulty
  const win = profile?.settings?.adaptWindow ?? 10
  const raiseAt = profile?.settings?.adaptRaiseAt ?? 0.85
  const lowerAt = profile?.settings?.adaptLowerAt ?? 0.55

  function start(topicSel = topic){
    if(!bank) return
    const storageKey = topicSel === 'svenska' ? 'practice_sv' : 'practice_ma'

    // rullande träff% och mål-nivå
    let acc = null
    try{
      const hist = JSON.parse(localStorage.getItem(`hist_${topicSel}`) || '[]')
      acc = rollingAccuracy(hist, win)
    }catch(e){}
    const targetDiff = decideDifficulty(baseMode, adaptive, acc, raiseAt, lowerAt)

    let items = []
    if(topicSel === 'svenska'){
      const all = bank.svenska?.items || []
      const pool = filterByDifficulty(all, targetDiff)
      const base = drawSmart(pool, Math.max(6, Math.min(perQuiz-2, perQuiz)), storageKey, noRepeats)
      let extra = []
      if ((bank.svenska?.passages?.length||0) > 0){
        const pass = bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
        extra = shuffle(pass.questions || []).slice(0, Math.min(2, perQuiz- base.length)).map(q=>({
          ...q, title: pass.title, text: pass.text, topic:'svenska'
        }))
      }
      items = shuffle([...base.map(x=>({ ...x, topic:'svenska' })), ...extra]).slice(0, perQuiz)
    }else{
      const all = bank.matematik?.items || []
      const pool = filterByDifficulty(all, targetDiff)
      const base = drawSmart(pool, perQuiz, storageKey, noRepeats)
      items = base.map(x=>({ ...x, topic:'matematik' }))
    }

    setTopic(topicSel)
    setSetQ(items)
    setIdx(0)
    setState('running')
    setLast({correct:null, explain:''})
    setShowHelp(false)
    resetTimer()
    console.debug('Practice start:', { topic: topicSel, targetDiff, accuracy: acc })
  }

  // Timer per fråga
  useEffect(()=>{
    if(state !== 'running') return
    clearInterval(timerRef.current)
    setRemaining(perQSec)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          onAnswered(false) // timeout = fel
          return perQSec
        }
        return r-1
      })
    }, 1000)
    return ()=> clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, idx, perQSec])

  function resetTimer(){
    clearInterval(timerRef.current)
    setRemaining(perQSec)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          onAnswered(false)
          return perQSec
        }
        return r-1
      })
    }, 1000)
  }

  function onAnswered(isCorrect){
    const q = setQ[idx]

    // uppdatera profil/statistik/poäng
    if(profile && saveProfile){
      const p = { ...profile }
      const t = q.topic || topic
      p.stats = p.stats || {}
      p.stats[t] = p.stats[t] || {answered:0, correct:0}
      p.stats[t].answered++
      if(isCorrect){
        p.stats[t].correct++
        p.points = (p.points||0) + 2 // övning = 2p / rätt
        if(p.points % 50 === 0) p.level = (p.level||1)+1
      }
      saveProfile(p)
    }

    // logga rullande historik för adaptiv nivå
    try{
      const key = `hist_${(q.topic||topic)}`
      const arr = JSON.parse(localStorage.getItem(key) || '[]')
      arr.push(!!isCorrect)
      localStorage.setItem(key, JSON.stringify(arr.slice(-100))) // behåll senaste 100
    }catch(e){}

    clearInterval(timerRef.current)
    setLast({ correct: isCorrect, explain: buildFallbackExplain(q) })
    setShowHelp(false) // stäng hjälp vid review
    setState('review')
  }

  function handleChoose(chosenIndex){
    const q = setQ[idx]
    const isCorrect = chosenIndex === q.correct
    onAnswered(isCorrect)
  }

  function handleBinary(ok){
    onAnswered(!!ok) // används av alla "icke-MC" kort (table/pie/chance/dnd)
  }

  function nextQuestion(){
    const next = idx + 1
    if(next >= setQ.length){
      setState('done')
    }else{
      setIdx(next)
      setLast({correct:null, explain:''})
      setShowHelp(false)
      setState('running')
    }
  }

  function restart(){
    setState('idle')
    setSetQ([])
    setIdx(0)
    setLast({correct:null, explain:''})
    setShowHelp(false)
    clearInterval(timerRef.current)
    setRemaining(perQSec)
  }

  const progressPct = setQ.length ? Math.round((idx/setQ.length)*100) : 0
  if(!bank) return <div className="card">Laddar…</div>

  const current = setQ[idx]
  const helpText = current ? buildConceptHint(current) : ''

  // Visa aktuell adaptiv nivå-chip
  let currentAcc = null
  try{
    const hist = JSON.parse(localStorage.getItem(`hist_${topic}`) || '[]')
    currentAcc = rollingAccuracy(hist, win)
  }catch(e){}
  const accPct = currentAcc==null ? '-' : Math.round(currentAcc*100)+'%'

  return (
    <div className="grid">
      <div className="card">
        <h1>🧩 Övningsläge</h1>
        <div className="row" style={{marginTop:6}}>
          <span className="chip">Frågor: {perQuiz}</span>
          <span className="chip">⏱️ {perQSec}s / fråga</span>
          <span className="chip">Ämne: {topic==='matematik'?'🧮 Matematik':'📖 Svenska'}</span>
          <span className="chip">Adaptiv: {profile?.settings?.adaptiveDifficulty ? 'På' : 'Av'}</span>
          <span className="chip">Träff: {accPct}</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          <button className="btn small ghost" onClick={()=>{restart(); start('svenska')}}>📖 Svenska</button>
          <button className="btn small ghost" onClick={()=>{restart(); start('matematik')}}>🧮 Matematik</button>
          {state!=='running' && state!=='review' && <button className="btn small" onClick={()=>start(topic)}>▶️ Starta</button>}
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      <div className="card">
        {state==='idle' && <p className="tiny">Välj ämne och klicka <b>Starta</b>. Frågorna anpassas efter resultat.</p>}

        {(state==='running' || state==='review') && current && (
          <>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="chip">{(current.topic||topic)==='matematik'?'🧮 Matematik':'📖 Svenska'}</div>
              <div className="chip">Fråga {idx+1} / {setQ.length}</div>
              {state==='running'
                ? <div className="pill">⏱️ {remaining}s</div>
                : <div className="pill">⏸️ Paus</div>}
            </div>
            <div className="progress"><div className="bar" style={{width:`${progressPct}%`}}/></div>

            {/* Välj rätt kort-typ */}
            {(() => {
              const common = {
                locked: state!=='running',
                showHint: showHelp,      // <-- viktigt: inte "showHint" direkt
                hintText: helpText
              }
              switch(current.type){
                case 'dnd':
                  return <DragDropCard q={current} onAnswer={handleBinary} {...common} />
                case 'table-fill':
                  return <TableFillCard q={current} onAnswer={handleBinary} {...common} />
                case 'pie-assign':
                  return <PieAssignCard q={current} onAnswer={handleBinary} {...common} />
                case 'chance-matrix':
                  return <ChanceMatrixCard q={current} onAnswer={handleBinary} {...common} />
                default:
                  return <QuestionCard q={current} onChoose={handleChoose} {...common} />
              }
            })()}

            {/* Sticky action-bar för mobil */}
            <div className="sticky-actions">
              <div className="row">
                {state==='running' && (
                  <>
                    <button
                    className="btn small ghost"
                    onClick={()=>{
                        setShowHelp(h=>{
                        if(!h && profile?.settings?.helpPenalty && profile && saveProfile){
                            const p = { ...profile, points: Math.max(0, (profile.points||0) - 1) }
                            saveProfile(p)
                        }
                        return !h
                        })
                    }}
                    title="Visa ledtråd"
                    >
                    {showHelp ? '🆘 Hjälp (aktiv)' : '🆘 Hjälp'}
                    </button>
                    {current?.type === undefined && (
                      <button className="btn small ghost" onClick={()=>handleChoose(-1)}>⏭️ Hoppa över</button>
                    )}
                  </>
                )}
                {state==='review' && <button className="btn small" onClick={nextQuestion}>➡️ Nästa</button>}
                <button className="btn small" onClick={restart}>🔁 Avsluta övning</button>
              </div>
            </div>

            {/* Feedback i review */}
            {state==='review' && (
              <div className="hint" style={{marginTop:10}}>
                {last.correct ? '✅ Rätt!' : '❌ Inte riktigt.'}
                <div style={{marginTop:6, whiteSpace:'pre-wrap', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'}}>
                  <b>Förklaring:</b> {last.explain}
                </div>
              </div>
            )}
          </>
        )}

        {state==='done' && (
          <>
            <h2>🎉 Klart med övningen!</h2>
            <p>Du kan köra igen—systemet undviker att upprepa frågor tills banken är slut och anpassar svårighet efter resultat.</p>
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={()=>start(topic)}>▶️ Kör igen ({topic==='matematik'?'🧮':'📖'})</button>
              <button className="btn alt" onClick={()=>setView?.('stats')}>📊 Se statistik</button>
              <button className="btn ghost" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}