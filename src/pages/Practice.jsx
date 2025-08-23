// src/pages/Practice.jsx
import { useEffect, useRef, useState, useMemo } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import TableFillCard from '../components/TableFillCard'
import PieAssignCard from '../components/PieAssignCard'
import ChanceMatrixCard from '../components/ChanceMatrixCard'
import { drawWeighted, shuffle } from '../lib/draw'
import { rollingAccuracy, decideDifficulty, filterByDifficulty } from '../lib/difficulty'
import { recordOutcome, weaknessWeights, areaOf } from '../lib/coach'

/* ===== Hjälp/strategi helpers (samma som tidigare) ===== */
function hoppar(start, steg, antal){ let out = `${start}`, cur = start; for(let i=0;i<Math.max(0,antal);i++){ cur += steg; out += ` ──➜ ${cur}` } return out }
function tallinje(start, slut, steg=1){ const asc=start<=slut, dir=asc?1:-1; let cur=start, pts=[cur], guard=12; while((asc&&cur<slut)||(!asc&&cur>slut)){ cur+=dir*Math.abs(steg); pts.push(cur); if(--guard<=0) break } return pts.join('  →  ') }

function buildMathStrategy(q){
  const txt=(q?.q||'').toLowerCase(), area=(q?.area||'matematik').toLowerCase()
  const nums=(txt.match(/-?\d+/g)||[]).map(n=>parseInt(n,10)); const [a,b]=nums
  if(area.includes('addition')){
    if(nums.length>=2){
      const big=Math.max(a,b), small=Math.min(a,b), tillTio=(10-(big%10))%10
      if(tillTio && tillTio<=small){
        return `🎯 Gör en tia:\n• ${big} + ${tillTio} = ${big+tillTio}\n• Lägg på resten: ${small-tillTio}\n`+hoppar(big,tillTio,1)+` ──➜ ${big+tillTio}  … + ${small-tillTio}`
      }
      return `🎯 Räkna från det större talet:\n• Börja på ${big} och hoppa ${small} steg.\n`+hoppar(big,1,Math.min(small,6))+(small>6?' …':'')
    }
    return `🎯 Gör hela tiotal först.`
  }
  if(area.includes('subtraktion')){
    if(nums.length>=2){
      const from=a, take=b, nerTillTia=from%10
      if(nerTillTia && (take>nerTillTia)){
        return `🎯 Dela upp ner till tia:\n• ${from} → ${from-nerTillTia}\n• Ta resten: ${take-nerTillTia}\n`+tallinje(from, from-take, nerTillTia)+(take-nerTillTia?`  →  ${from-take}`:'')
      }
      return `🎯 Räkna upp: börja vid ${from - take} och hoppa till ${from}.\n`+tallinje(from-take, from, 1)
    }
    return `🎯 Ner till jämn tia först, eller "räkna upp".`
  }
  if(area.includes('multiplikation')){
    if(nums.length>=2){
      if(a===9||b===9){ const n=a===9?b:a; return `🎯 9-knepet: 10×${n} − ${n}` }
      if(a===4||b===4){ const n=a===4?b:a; return `🎯 Dubbla-dubbla (4×${n})` }
      if(a===8||b===8){ const n=a===8?b:a; return `🎯 Dubbla tre gånger (8×${n})` }
      if(a===5||b===5){ const n=a===5?b:a; return `🎯 5-steg: 5, 10, 15, …` }
      return `🎯 Bryt upp: n×m = n×(m−1) + n.`
    }
    return `🎯 Upprepad addition eller bryt mot 10.`
  }
  if(area.includes('division')){
    if(nums.length>=2 && b){ return `🎯 Multiplikation baklänges: hur många ${b}:or ryms i ${a}?` }
    return `🎯 “Hur många grupper?”.`
  }
  if(area.includes('taluppfattning')){
    if(txt.includes('tiotal')&&a!=null) return `🎯 ${a} = ${Math.floor(a/10)} tiotal och ${a%10} ental.`
    if(txt.includes('störst')) return `🎯 Jämför tiotal först, sedan ental.`
    return `🎯 Dela upp i tiotal/ental.`
  }
  if(area.includes('klock')||txt.includes('halv')||txt.includes('kvart')){
    if(txt.includes('halv')) return `🎯 “Halv tre” = …:30.`
    if(txt.includes('kvart')) return `🎯 Kvart = 15 min. Över = :15, I = :45.`
    return `🎯 Halv = :30, Kvart = :15 / :45.`
  }
  if(area.includes('mätning')) return `🎯 1 m = 100 cm, 1 kg = 1000 g.`
  if(area.includes('geometri')){
    if(txt.includes('hörn')) return `🎯 Räkna hörn. Kvadrat har 4 hörn.`
    return `🎯 Jämför antal sidor/hörn och längder.`
  }
  if(area.includes('problem')||txt.includes('har ')||txt.includes('får ')) return `🎯 Mini-ekvation: start ± förändring = svar.`
  return `🎯 Dela upp i enkla steg: sikta på 10/100, dubbla/halvera, överslag.`
}

function conceptHint(q){
  if(q?.hint) return q.hint;
  if((q?.topic||'')==='matematik') return buildMathStrategy(q);
  const t=(q?.q||'').toLowerCase();
  const area=(q?.area||'').toLowerCase();
  if(area.includes('grammatik')){
    if(t.includes('substantiv')) return 'Substantiv = namn (katt, bok, Lisa).';
    if(t.includes('verb')) return 'Verb = något man gör/är (springer, läser, är).';
    if(t.includes('adjektiv')) return 'Adjektiv = beskriver (stor, röd, snabb).';
    if(t.includes('pronomen')) return 'Pronomen = ersätter substantiv (han, hon, den).';
    if(t.includes('preposition')) return 'Preposition = läge/riktning (på, i, under, bakom).';
    return 'Grammatik: substantiv/verb/adjektiv – tänk funktion.';
  }
  if(area.includes('stavning')) return 'Jämför ljud & bokstav: sj-, tj-, hj-, dubbelteckning.';
  if(area.includes('ord')) return 'Synonym ≈ liknande ord. Motsats = tvärtom.';
  if(area.includes('läs')) return 'Läs igen och leta ord i texten som matchar frågan.';
  return 'Fundera på vad frågan faktiskt frågar efter.';
}

/* ===== Komponent ===== */
export default function Practice({ profile, saveProfile, bank, setView }){
  const [topic, setTopic] = useState('svenska')
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'review' | 'done'
  const [remaining, setRemaining] = useState(profile?.settings?.perQuestionTimerSec || 45)
  const [last, setLast] = useState({correct:null, explain:''})
  const [showHelp, setShowHelp] = useState(false)
  const [coach, setCoach] = useState(true) // ⬅️ nytt: lärande-läge
  const [focusWeak, setFocusWeak] = useState(true) // ⬅️ nytt: svaghetsfokus
  const [questionCount, setQuestionCount] = useState(profile?.settings?.perQuiz || 10)
  const [levelChoice, setLevelChoice] = useState('auto') // 'auto'|'easy'|'np'|'hard'

  const perQSec = profile?.settings?.perQuestionTimerSec || 45
  const noRepeats = profile?.settings?.noRepeats !== false

  // Adaptiva parametrar
  const baseMode = profile?.settings?.difficultyMode || 'np'
  const adaptive = !!profile?.settings?.adaptiveDifficulty
  const win = profile?.settings?.adaptWindow ?? 10
  const raiseAt = profile?.settings?.adaptRaiseAt ?? 0.85
  const lowerAt = profile?.settings?.adaptLowerAt ?? 0.55

  // rekommenderad nivå per ämne
  const recommendedLevel = useMemo(()=>{
    try{
      const hist = JSON.parse(localStorage.getItem(`hist_${topic}`) || '[]')
      const acc = rollingAccuracy(hist, win)
      return decideDifficulty(baseMode, true, acc, raiseAt, lowerAt)
    }catch(e){ return 'np' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, baseMode, win, raiseAt, lowerAt])
  const levelEffective = (levelChoice==='auto' ? (recommendedLevel || 'np') : levelChoice)

  function start(topicSel = topic){
    if(!bank) return
    const storageKey = topicSel === 'svenska' ? 'practice_sv' : 'practice_ma'
    // rullande träff% för adaptiv nivå
    let acc = null
    try{
      const hist = JSON.parse(localStorage.getItem(`hist_${topicSel}`) || '[]')
      acc = rollingAccuracy(hist, win)
    }catch(e){}
    const targetDiff = levelChoice === 'auto'
      ? decideDifficulty(baseMode, adaptive, acc, raiseAt, lowerAt)
      : levelChoice

    // filtrera på nivå
    const all = topicSel==='svenska' ? (bank.svenska?.items||[]) : (bank.matematik?.items||[])
    const pool = filterByDifficulty(all, targetDiff)

    // vikter per area om svaghetsfokus
    let weights = null
    if(focusWeak){
      const areas = Array.from(new Set(pool.map(x => (x.area||'okänd').toLowerCase())))
      weights = weaknessWeights(topicSel, areas, /*window*/ 50)
    }

    // dra frågor
    const base = drawWeighted(pool, questionCount, weights, storageKey, noRepeats)
    let items = base.map(x=>({ ...x, topic: topicSel }))

    // (svenska) blanda in upp till 2 passagefrågor om plats finns
    if(topicSel==='svenska' && (bank.svenska?.passages?.length||0) > 0 && items.length < questionCount){
      const pass = bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
      const need = Math.min(2, questionCount - items.length)
      const extra = shuffle(pass.questions || []).slice(0, need).map(q=>({
        ...q, title: pass.title, text: pass.text, topic:'svenska', area:'läsförståelse'
      }))
      items = shuffle([...items, ...extra]).slice(0, questionCount)
    }

    setTopic(topicSel)
    setQuestions(items)
    setIdx(0)
    setState('running')
    setLast({correct:null, explain:''})
    setShowHelp(false)
    resetTimer()
  }

  // timer
  const timerRef = useRef(null)
  useEffect(()=>{
    if(state!=='running') return
    clearInterval(timerRef.current)
    setRemaining(perQSec)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          onAnswered(false) // timeout
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

  function onAnswered(ok){
    const q = questions[idx]

    // spara historik för adaptivitet + svagheter
    recordOutcome(q.topic || topic, q, !!ok)

    // uppdatera profil/poäng
    if(profile && saveProfile){
      const p = { ...profile }
      const t = q.topic || topic
      p.stats = p.stats || {}
      p.stats[t] = p.stats[t] || {answered:0, correct:0}
      p.stats[t].answered++
      if(ok){
        p.stats[t].correct++
        p.points = (p.points||0) + 2
        if(p.points % 50 === 0) p.level = (p.level||1)+1
      }
      saveProfile(p)
    }

    clearInterval(timerRef.current)
    const area = areaOf(q)
    const coachText = coach
      ? (q.topic==='matematik' ? buildMathStrategy(q)
         : (q.hint || conceptHint(q) + (area ? ` (område: ${area})` : '')))
      : (q.explain || q.hint || conceptHint(q))

    setLast({ correct: !!ok, explain: coachText })
    setShowHelp(false)
    setState('review')
  }

  function handleChoose(index){
    const q = questions[idx]
    const ok = (index === q.correct)
    onAnswered(ok)
  }
  function handleBinary(ok){ onAnswered(!!ok) }

  function nextQuestion(){
    const next = idx + 1
    if(next >= questions.length){
      setState('done')
    }else{
      setIdx(next); setLast({correct:null, explain:''}); setShowHelp(false); setState('running')
    }
  }
  function restart(){
    setState('idle'); setQuestions([]); setIdx(0); setLast({correct:null, explain:''}); setShowHelp(false);
    clearInterval(timerRef.current); setRemaining(perQSec)
  }

  const current = questions[idx]
  const progressPct = questions.length ? Math.round((idx/questions.length)*100) : 0

  // UI
  return (
    <div className="grid">
      <div className="card">
        <h1>🧩 Övningsläge (lärande)</h1>
        <div className="row" style={{flexWrap:'wrap', marginTop:6}}>
          <span className="chip">Ämne:</span>
          <button className="btn small ghost" aria-pressed={topic==='svenska'} onClick={()=>{restart(); setTopic('svenska')}}>📖 Svenska</button>
          <button className="btn small ghost" aria-pressed={topic==='matematik'} onClick={()=>{restart(); setTopic('matematik')}}>🧮 Matematik</button>
        </div>

        <div className="row" style={{flexWrap:'wrap', marginTop:8}}>
          <span className="chip">Nivå:</span>
          {['auto','easy','np','hard'].map(l => (
            <label key={l} className="chip" style={{cursor:'pointer'}}>
              <input type="radio" name="level" checked={levelChoice===l} onChange={()=>setLevelChoice(l)} /> {l==='auto' ? `Auto (${recommendedLevel})` : l.toUpperCase()}
            </label>
          ))}
        </div>

        <div className="row" style={{alignItems:'center', marginTop:8}}>
          <div className="chip">Antal frågor:</div>
          <input
            type="number" min="3" max="30" step="1"
            value={questionCount}
            onChange={e=>setQuestionCount(Math.max(3, Math.min(30, Number(e.target.value)||10)))}
            style={{width:90, padding:'6px', fontSize:'1rem', border:'1px solid #e5e7eb', borderRadius:8}}
          />
        </div>

        <div className="row" style={{flexWrap:'wrap', marginTop:8}}>
          <label className="chip" style={{cursor:'pointer'}}>
            <input type="checkbox" checked={focusWeak} onChange={e=>setFocusWeak(e.target.checked)} />
            Fokusera på svagheter
          </label>
          <label className="chip" style={{cursor:'pointer'}}>
            <input type="checkbox" checked={coach} onChange={e=>setCoach(e.target.checked)} />
            Coach-läge (stegvis hjälp)
          </label>
        </div>

        <div className="row" style={{marginTop:10}}>
          {state!=='running' && state!=='review' && (
            <button className="btn small" onClick={()=>start(topic)}>
              ▶️ Starta ({levelEffective}, {questionCount})
            </button>
          )}
          <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
        </div>
      </div>

      <div className="card">
        {state==='idle' && <p className="tiny">Välj ämne, nivå, antal frågor. Med <b>Fokusera på svagheter</b> tränar du mer på områden där tidigare prov/övningar gått sämre. <b>Coach-läge</b> ger extra vägledning efter varje svar.</p>}

        {(state==='running' || state==='review') && current && (
          <>
            <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap'}}>
              <div className="chip">{(current.topic||topic)==='matematik'?'🧮 Matematik':'📖 Svenska'}</div>
              <div className="chip">Nivå: {levelEffective}</div>
              <div className="chip">Fråga {idx+1} / {questions.length}</div>
              {state==='running' ? <div className="pill">⏱️ {remaining}s</div> : <div className="pill">⏸️ Paus</div>}
            </div>
            <div className="progress"><div className="bar" style={{width:`${progressPct}%`}}/></div>

            {(() => {
              const common = { locked: state!=='running', showHint: showHelp, hintText: conceptHint(current) }
              switch(current.type){
                case 'dnd': return <DragDropCard q={current} onAnswer={handleBinary} {...common} />
                case 'table-fill': return <TableFillCard q={current} onAnswer={handleBinary} {...common} />
                case 'pie-assign': return <PieAssignCard q={current} onAnswer={handleBinary} {...common} />
                case 'chance-matrix': return <ChanceMatrixCard q={current} onAnswer={handleBinary} {...common} />
                default: return <QuestionCard q={current} onChoose={handleChoose} {...common} />
              }
            })()}

            {/* Sticky actions */}
            <div className="sticky-actions">
              <div className="row">
                {state==='running' && (
                  <>
                    <button
                      className="btn small ghost"
                      onClick={()=>setShowHelp(h=>!h)}
                      title="Visa begreppstips"
                    >
                      {showHelp ? '🆘 Hjälp (aktiv)' : '🆘 Hjälp'}
                    </button>
                    {current?.type === undefined && (
                      <button className="btn small ghost" onClick={()=>handleChoose(-1)}>⏭️ Skippa</button>
                    )}
                  </>
                )}
                {state==='review' && <button className="btn small" onClick={nextQuestion}>➡️ Nästa</button>}
                <button className="btn small" onClick={restart}>🔁 Avsluta</button>
              </div>
            </div>

            {/* Coach-feedback i review */}
            {state==='review' && (
              <div className="hint" style={{marginTop:10}}>
                {last.correct ? '✅ Rätt!' : '❌ Inte riktigt.'}
                <div style={{marginTop:6, whiteSpace:'pre-wrap', fontFamily:'ui-monospace, Menlo, Consolas, monospace'}}>
                  <b>Coach:</b> {last.explain}
                </div>
              </div>
            )}
          </>
        )}

        {state==='done' && (
          <>
            <h2>🎉 Klart!</h2>
            <p>Vill du fokusera ännu mer på ditt svagaste område? Låt “Fokusera på svagheter” vara på och kör igen.</p>
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={()=>start(topic)}>▶️ Kör igen ({levelEffective}, {questionCount})</button>
              <button className="btn alt" onClick={()=>setView?.('stats')}>📊 Se statistik</button>
              <button className="btn ghost" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}