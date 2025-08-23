// src/pages/Practice.jsx
import { useEffect, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import { drawSmart, shuffle } from '../lib/draw'

const FALLBACK_EXPLAINS = {
  stavning: "Stavning: Välj den korrekta stavningen. Jämför bokstäver och ljud – särskilt sj-, tj-, hj-, lj-, skj-.",
  grammatik: "Grammatik: Substantiv = namn på saker/djur/personer/platser. Verb = något man gör. Adjektiv = beskriver egenskaper.",
  ordforstaelse: "Ordförståelse: Synonym betyder liknande ord. Motsats betyder tvärtom.",
  'läsförståelse': "Läsförståelse: Leta efter stöd i texten. Svaret står ofta tydligt uttryckt.",
  matematik: "Matematik: Följ räknesättets regler och tänk steg för steg (tiotal/ental)."
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
    return "Grammatik: Substantiv (namn), verb (handling), adjektiv (beskriver)."
  }
  if(area === 'stavning') return "Stavning: jämför bokstäver och ljud – sj-, tj-, hj-, lj-, skj- kan vara kluriga."
  if(area === 'ordforstaelse') return "Synonym = liknande ord. Motsats = tvärtom."
  if(area === 'läsförståelse') return "Läsförståelse: Leta efter stöd i texten. Svaret står ofta tydligt uttryckt."
  if(q?.topic === 'matematik') return buildMathStrategy(q)
  return "Fundera på vad frågan egentligen frågar efter och jämför alternativen."
}

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

// Bygger en lösningsstrategi för matte utan att avslöja svaret
function buildMathStrategy(q){
  const txt = (q?.q || '').toLowerCase()
  const area = q?.area || 'matematik'

  // fånga heltal i uppgiften
  const nums = (txt.match(/-?\d+/g) || []).map(n => parseInt(n,10))
  const [a,b,c] = nums

  // Hjälpregler per område
  if(area.includes('addition')){
    if(nums.length >= 2){
      const big = Math.max(a,b), small = Math.min(a,b)
      const onesSum = (a%10 + b%10)
      if(onesSum >= 10){
        const tillTio = 10 - (big%10)
        return `Tänk "gör en tia": ta ${tillTio} från det andra talet så du får en jämn tia (${big} + ${tillTio}). Lägg sedan på resten. Det gör huvudräkningen lätt.`
      }
      if(a===b) return `Dubbelt tänk: ${a}+${b} är dubbelt av ${a}. Räkna dubblan först och justera vid behov.`
      return `Räkna från det större talet och "räkna på": börja på ${big} och hoppa ${small} steg framåt (5-steg och 1-steg).`
    }
    return `Gör hela tiotal först. Dela upp så du träffar 10/20/30 och lägg på resten.`
  }

  if(area.includes('subtraktion')){
    if(nums.length >= 2){
      const from = a, take = b
      const ones = from % 10
      if(ones < (take % 10)){
        return `Låna till en tia: gå först ner till närmaste jämna tia (${from - ones} eller ${from - (ones+10) + 10}), räkna sedan resten. Att sikta på 10/20 gör det lätt.`
      }
      return `Dela upp borttag: ta först ner till närmaste tia (${from - ones}) och ta sedan resten. Alternativt: "räkna upp" från det mindre talet till det större.`
    }
    return `Använd "räkna upp": börja vid det mindre talet, hoppa till tian, och vidare till det större. Summan av hoppen är svaret.`
  }

  if(area.includes('multiplikation')){
    if(nums.length >= 2){
      if((a===5||b===5)) return `Femmornas tabell: räkna i 5-steg (5,10,15,20...). Dela upp i tiotal/ental om det blir många steg.`
      if((a===9||b===9)) return `Niornas knep: produkten är 10×talet minus talet själv. Ex: 9×6 = 10×6 − 6.`
      if((a===4||b===4)) return `Dubbla-dubbla: 4×n är dubbla dubblan av n. Dubbla n → dubbla igen.`
      if((a===8||b===8)) return `Dubbla tre gånger: 8×n = n × 2 × 2 × 2.`
      return `Bryt upp: n×m = n×(m−1) + n. Använd en tabell du kan (t.ex. ×5 eller ×10) och justera.`
    }
    return `Använd upprepad addition eller bryt mot 10: n×m = n×10 − n×(10−m).`
  }

  if(area.includes('division')){
    if(nums.length >= 2){
      return `Tänk "hur många ${b} får plats i ${a}?". Använd en närliggande multiplikationstabell: ${b}×? ≈ ${a}. Prova med tiotal och justera.`
    }
    return `Kom ihåg: division är omvänd multiplikation. Hitta faktan 'deler × kvot = talet'.`
  }

  if(area.includes('taluppfattning')){
    if(txt.includes('tiotal') && nums.length){
      const n = a
      return `${n} har ${Math.floor(n/10)} hela tiotal och ${n%10} ental. Dela upp talet i tioklump + ental för att resonera.`
    }
    if(txt.includes('störst') && nums.length>=2){
      return `Jämför först tiotalen. Om de är lika, jämför entalen. Störst tiotal vinner.`
    }
    return `Dela upp tal i tiotal och ental. Resonera först på tiotalen, sedan på entalen.`
  }

  if(area.includes('klock') || txt.includes('halv') || txt.includes('kvart')){
    if(txt.includes('halv')){
      return `“Halv tre” betyder 30 minuter innan tre → klockan har passerat två: digitalt 02:30 (eller 14:30 på eftermiddagen).`
    }
    if(txt.includes('kvart')){
      return `“Kvart” är 15 minuter. “Kvart över X” = X:15. “Kvart i X” = (X−1):45.`
    }
    return `Tänk i 60 minuter per varv. Halv = :30, kvart = :15 eller :45.`
  }

  if(area.includes('mätning')){
    return `Kom ihåg prefix: 1 m = 100 cm, 1 km = 1000 m. För vikt: 1 kg = 1000 g. Flytta decimalen enligt prefixet.`
  }

  if(area.includes('geometri')){
    if(txt.includes('hörn')) return `En kvadrat har 4 hörn och 4 lika långa sidor. Räkna hörnen ett och ett.`
    return `Tänk på egenskaper: antal sidor/hörn, lika långa sidor, räta hörn. Skissa snabbt i huvudet.`
  }

  if(area.includes('problem') || txt.includes('har') || txt.includes('får')){
    return `Skriv upp det som en liten ekvation: vad börjar man med, vad läggs till eller tas bort? Rita gärna streck eller klossar i huvudet för att se förändringen.`
  }

  // Fallback för okända/övriga mattefrågor
  return `Dela upp i enklare steg: sikta på 10/100, använd dubbla/halvera, och kontrollera rimlighet med överslag.`
}

export default function Practice({ profile, saveProfile, bank, setView }){
  const [topic, setTopic] = useState('svenska') // 'svenska' | 'matematik'
  const [setQ, setSetQ] = useState([])
  const [idx, setIdx] = useState(0)
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'review' | 'done'
  const [remaining, setRemaining] = useState(profile?.settings?.perQuestionTimerSec || 45)
  const [last, setLast] = useState({correct:null, explain:''})
  const [showHelp, setShowHelp] = useState(false) // styr visning av ledtråd
  const timerRef = useRef(null)

  const perQuiz = profile?.settings?.perQuiz || 10
  const perQSec = profile?.settings?.perQuestionTimerSec || 45
  const noRepeats = profile?.settings?.noRepeats !== false

  function start(topicSel = topic){
    if(!bank) return
    const storageKey = topicSel === 'svenska' ? 'practice_sv' : 'practice_ma'
    let items = []

    if(topicSel === 'svenska'){
      // Fristående + ev. några passagefrågor
      const base = drawSmart(bank.svenska?.items||[], Math.max(6, Math.min(perQuiz-2, perQuiz)), storageKey, noRepeats)
      let extra = []
      if ((bank.svenska?.passages?.length||0) > 0){
        const pass = bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
        extra = shuffle(pass.questions || []).slice(0, Math.min(2, perQuiz- base.length)).map(q=>({
          ...q, title: pass.title, text: pass.text, topic:'svenska'
        }))
      }
      items = shuffle([...base.map(x=>({ ...x, topic:'svenska' })), ...extra]).slice(0, perQuiz)
    }else{
      const base = drawSmart(bank.matematik?.items||[], perQuiz, storageKey, noRepeats)
      items = base.map(x=>({ ...x, topic:'matematik' }))
    }

    setTopic(topicSel)
    setSetQ(items)
    setIdx(0)
    setState('running')
    setLast({correct:null, explain:''})
    setShowHelp(false)
    resetTimer()
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
    clearInterval(timerRef.current)
    setLast({ correct: isCorrect, explain: buildFallbackExplain(q) })
    setShowHelp(false)
    setState('review')
  }

  function handleChoose(chosenIndex){
    const q = setQ[idx]
    const isCorrect = chosenIndex === q.correct
    onAnswered(isCorrect)
  }

  function handleDnd(ok){
    onAnswered(!!ok)
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

  return (
    <div className="grid">
      <div className="card">
        <h1>🧩 Övningsläge</h1>
        <div className="row" style={{marginTop:6}}>
          <span className="chip">Frågor: {perQuiz}</span>
          <span className="chip">⏱️ {perQSec}s / fråga</span>
          <span className="chip">Ämne: {topic==='matematik'?'🧮 Matematik':'📖 Svenska'}</span>
        </div>
        <div className="row" style={{marginTop:10}}>
          <button className="btn small ghost" onClick={()=>{restart(); start('svenska')}}>📖 Svenska</button>
          <button className="btn small ghost" onClick={()=>{restart(); start('matematik')}}>🧮 Matematik</button>
          {state!=='running' && state!=='review' && <button className="btn small" onClick={()=>start(topic)}>▶️ Starta</button>}
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      <div className="card">
        {state==='idle' && <p className="tiny">Välj ämne och klicka <b>Starta</b>.</p>}

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

            {/* Frågekort */}
            {current?.type === 'dnd' ? (
              <DragDropCard
                q={current}
                locked={state!=='running'}
                onAnswer={handleDnd}
                showHint={showHelp}
                hintText={helpText}
              />
            ) : (
              <QuestionCard
                q={current}
                onChoose={handleChoose}
                locked={state!=='running'}
                showHint={showHelp}
                hintText={helpText}
              />
            )}

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
                      {showHelp ? '🙈 Dölj hjälp' : '🆘 Hjälp'}
                    </button>
                    {current?.type !== 'dnd' && (
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
                <div style={{marginTop:6, whiteSpace:'pre-wrap'}}><b>Förklaring:</b> {last.explain}</div>
              </div>
            )}
          </>
        )}

        {state==='done' && (
          <>
            <h2>🎉 Klart med övningen!</h2>
            <p>Du kan köra igen—systemet undviker att upprepa frågor tills banken är slut.</p>
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