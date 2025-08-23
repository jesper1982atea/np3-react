// src/pages/Exam.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import DragDropCard from '../components/DragDropCard'
import TableFillCard from '../components/TableFillCard'
import PieAssignCard from '../components/PieAssignCard'
import ChanceMatrixCard from '../components/ChanceMatrixCard'
import { drawWeighted, shuffle } from '../lib/draw'
import { rollingAccuracy, decideDifficulty, filterByDifficulty } from '../lib/difficulty'
import { recordOutcome, weaknessWeights, areaOf } from '../lib/coach'

export default function Exam({ profile, saveProfile, bank, setView }){
  // ---- konfiguration / val innan start ----
  const [topic, setTopic] = useState('svenska') // 'svenska' | 'matematik'
  const [levelChoice, setLevelChoice] = useState('np') // 'auto'|'easy'|'np'|'hard'
  const [questionCount, setQuestionCount] = useState(profile?.settings?.perExam || 20)
  const [minutes, setMinutes] = useState(profile?.settings?.examTimerTotalMin || 25)
  const [coach, setCoach] = useState(false) // Lärande prov (hjälp/feedback direkt)
  const [focusWeak, setFocusWeak] = useState(false) // vikta mot svaga områden

  // ---- exam state ----
  const [state, setState] = useState('idle') // 'idle' | 'running' | 'review' (coach) | 'finished'
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState([]) // {qid, chosen, correctIndex, ok}
  const [remaining, setRemaining] = useState(Math.max(1, minutes)*60)
  const timerRef = useRef(null)
  const [showHelp, setShowHelp] = useState(false)
  const [lastExplain, setLastExplain] = useState('')

  // ---- adaptiv nivå (rekommendation) ----
  const baseMode = profile?.settings?.difficultyMode || 'np'
  const adaptive = !!profile?.settings?.adaptiveDifficulty
  const win = profile?.settings?.adaptWindow ?? 10
  const raiseAt = profile?.settings?.adaptRaiseAt ?? 0.85
  const lowerAt = profile?.settings?.adaptLowerAt ?? 0.55

  const recommendedLevel = useMemo(()=>{
    try{
      const hist = JSON.parse(localStorage.getItem(`hist_${topic}`) || '[]')
      const acc = rollingAccuracy(hist, win)
      return decideDifficulty(baseMode, true, acc, raiseAt, lowerAt)
    }catch(e){ return 'np' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, baseMode, win, raiseAt, lowerAt])

  const effectiveLevel = levelChoice==='auto' ? (recommendedLevel || 'np') : levelChoice
  const perQSec = profile?.settings?.perQuestionTimerSec || 45 // används bara i coach-review när man hoppar vidare
  const noRepeats = profile?.settings?.noRepeats !== false

  // ---- hjälpbyggare (kort & tydligt, spoilar ej) ----
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
    if(q?.hint) return q.hint
    if((q?.topic||'')==='matematik') return buildMathStrategy(q)
    const t=(q?.q||'').toLowerCase()
    const area=(q?.area||'').toLowerCase()
    if(area.includes('grammatik')){
      if(t.includes('substantiv')) return 'Substantiv = namn (katt, bok, Lisa).'
      if(t.includes('verb')) return 'Verb = något man gör/är (springer, läser, är).'
      if(t.includes('adjektiv')) return 'Adjektiv = beskriver (stor, röd, snabb).'
      if(t.includes('pronomen')) return 'Pronomen = ersätter substantiv (han, hon, den).'
      if(t.includes('preposition')) return 'Preposition = läge/riktning (på, i, under, bakom).'
      return 'Grammatik: substantiv/verb/adjektiv – tänk funktion.'
    }
    if(area.includes('stavning')) return 'Jämför ljud & bokstav: sj-, tj-, hj-, lj-, dubbelteckning.'
    if(area.includes('ord')) return 'Synonym ≈ liknande ord. Motsats = tvärtom.'
    if(area.includes('läs')) return 'Läs igen och leta ord i texten som matchar frågan.'
    return 'Fundera på vad frågan faktiskt frågar efter.'
  }

  // ---- starta provet ----
  function startExam(){
    if(!bank) return
    const storageKey = topic === 'svenska' ? 'exam_sv' : 'exam_ma'

    // adaptiv nivå för 'auto'
    let acc = null
    try{
      const hist = JSON.parse(localStorage.getItem(`hist_${topic}`) || '[]')
      acc = rollingAccuracy(hist, win)
    }catch(e){}
    const targetDiff = levelChoice === 'auto'
      ? decideDifficulty(baseMode, adaptive, acc, raiseAt, lowerAt)
      : levelChoice

    // filtrera efter nivå
    const all = topic==='svenska' ? (bank.svenska?.items||[]) : (bank.matematik?.items||[])
    const pool = filterByDifficulty(all, targetDiff)

    // svaghetsvikter
    let weights = null
    if(focusWeak){
      const areas = Array.from(new Set(pool.map(x => (x.area||'okänd').toLowerCase())))
      weights = weaknessWeights(topic, areas, /*window*/ 80)
    }

    // dra frågor
    let items = drawWeighted(pool, questionCount, weights, storageKey, noRepeats)
      .map(x => ({ ...x, topic }))

    // (svenska) – blanda in upp till 3 passagefrågor om plats finns
    if(topic==='svenska' && (bank.svenska?.passages?.length||0) > 0 && items.length < questionCount){
      const pass = bank.svenska.passages[Math.floor(Math.random()*bank.svenska.passages.length)]
      const need = Math.min(3, questionCount - items.length)
      const extra = shuffle(pass.questions || []).slice(0, need).map(q=>({
        ...q, title: pass.title, text: pass.text, topic:'svenska', area:'läsförståelse'
      }))
      items = shuffle([...items, ...extra]).slice(0, questionCount)
    }

    setQuestions(items)
    setIdx(0)
    setAnswers([])
    setState('running')
    setShowHelp(false)
    setLastExplain('')
    // ställ timern
    const total = Math.max(1, parseInt(minutes,10) || 25) * 60
    setRemaining(total)
  }

  // ---- prov-timer (total tid) ----
  useEffect(()=>{
    if(state!=='running') return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(()=>{
      setRemaining(r=>{
        if(r<=1){
          clearInterval(timerRef.current)
          finishExam() // tiden slut
          return 0
        }
        return r-1
      })
    }, 1000)
    return ()=> clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function finishExam(){
    clearInterval(timerRef.current)
    setState('finished')
  }

  // ---- svarshantering ----
  function answerCurrent(choiceIndex){
    const q = questions[idx]
    const ok = (choiceIndex === q.correct)

    // logga till coach/historik (påverkar framtida övningar)
    recordOutcome(q.topic || topic, q, ok)

    // spara lokalt för resultat
    setAnswers(prev => [...prev, {
      qid: q.id || `${topic}-${idx}`,
      chosen: choiceIndex,
      correctIndex: q.correct,
      ok
    }])

    // uppdatera profilpoäng lite (exam: 3p/rätt)
    if(profile && saveProfile){
      const p = { ...profile }
      const t = q.topic || topic
      p.stats = p.stats || {}
      p.stats[t] = p.stats[t] || {answered:0, correct:0}
      p.stats[t].answered++
      if(ok){
        p.stats[t].correct++
        p.points = (p.points||0) + 3
        if(p.points % 50 === 0) p.level = (p.level||1)+1
      }
      saveProfile(p)
    }

    if(coach){
      // visa coach-feedback innan nästa
      const coachText = q.topic==='matematik'
        ? buildMathStrategy(q)
        : (q.explain || q.hint || conceptHint(q))
      setLastExplain(coachText)
      setState('review')
    }else{
      // strikt läge: direkt vidare
      goNext()
    }
  }

  function answerBinary(ok){
    answerCurrent(ok ? /*“rätt”*/ questions[idx]?.correct : /*“fel”*/ -999)
  }

  function goNext(){
    const next = idx + 1
    if(next >= questions.length){
      finishExam()
    }else{
      setIdx(next)
      setShowHelp(false)
      setLastExplain('')
      if(coach){
        // “per fråga”-känsla i coach-läge: lätt reset-känsla
        // (vi lämnar total-timer orörd)
      }
    }
  }

  function restart(){
    clearInterval(timerRef.current)
    setQuestions([]); setIdx(0); setAnswers([]); setShowHelp(false); setLastExplain('')
    setRemaining(Math.max(1, minutes)*60)
    setState('idle')
  }

  // ---- render helpers ----
  const current = questions[idx]
  const progressPct = questions.length ? Math.round((idx/questions.length)*100) : 0
  function fmtTime(s){ const m=Math.floor(s/60), ss=String(s%60).padStart(2,'0'); return `${m}:${ss}` }

  // ---- UI ----
  return (
    <div className="grid">
      <div className="card">
        <h1>📝 Provläge</h1>

        {state==='idle' && (
          <>
            <div className="row" style={{flexWrap:'wrap'}}>
              <span className="chip">Ämne:</span>
              <button className="btn small ghost" aria-pressed={topic==='svenska'} onClick={()=>setTopic('svenska')}>📖 Svenska</button>
              <button className="btn small ghost" aria-pressed={topic==='matematik'} onClick={()=>setTopic('matematik')}>🧮 Matematik</button>
            </div>

            <div className="row" style={{flexWrap:'wrap', marginTop:8}}>
              <span className="chip">Nivå:</span>
              {['auto','easy','np','hard'].map(l => (
                <label key={l} className="chip" style={{cursor:'pointer'}}>
                  <input type="radio" name="level" checked={levelChoice===l} onChange={()=>setLevelChoice(l)} />
                  {l==='auto' ? `Auto (${recommendedLevel})` : l.toUpperCase()}
                </label>
              ))}
            </div>

            <div className="row" style={{alignItems:'center', marginTop:8}}>
              <div className="chip">Antal frågor:</div>
              <input
                type="number" min="5" max="40" step="1"
                value={questionCount}
                onChange={e=>setQuestionCount(Math.max(5, Math.min(40, Number(e.target.value)||20)))}
                style={{width:90, padding:'6px', fontSize:'1rem', border:'1px solid #e5e7eb', borderRadius:8}}
              />
            </div>

            <div className="row" style={{alignItems:'center', marginTop:8}}>
              <div className="chip">Provtid (min):</div>
              <input
                type="number" min="5" max="90" step="1"
                value={minutes}
                onChange={e=>setMinutes(Math.max(5, Math.min(90, Number(e.target.value)||25)))}
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
                Lärande prov (Coach)
              </label>
            </div>

            <div className="row" style={{marginTop:10}}>
              <button className="btn small" onClick={startExam}>▶️ Starta prov ({effectiveLevel}, {questionCount})</button>
              <button className="btn small alt" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </div>
          </>
        )}

        {state!=='idle' && (
          <div className="row" style={{marginTop:6, flexWrap:'wrap', justifyContent:'space-between'}}>
            <div className="chip">{topic==='matematik'?'🧮 Matematik':'📖 Svenska'}</div>
            <div className="chip">Nivå: {effectiveLevel}</div>
            <div className="chip">⏳ Tid kvar: {fmtTime(remaining)}</div>
          </div>
        )}
      </div>

      <div className="card">
        {state==='running' && current && (
          <>
            <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap'}}>
              <div className="chip">Fråga {idx+1} / {questions.length}</div>
              <div className="progress" style={{flex:1, margin:'0 10px'}}><div className="bar" style={{width:`${progressPct}%`}}/></div>
              <div className="pill">{coach ? '👩‍🏫 Lärande' : '🧪 Standard'}</div>
            </div>

            {/* korttyp */}
            {(() => {
              const common = { locked:false, showHint: coach && showHelp, hintText: coach ? conceptHint(current) : '' }
              switch(current.type){
                case 'dnd': return <DragDropCard q={current} onAnswer={answerBinary} {...common} />
                case 'table-fill': return <TableFillCard q={current} onAnswer={answerBinary} {...common} />
                case 'pie-assign': return <PieAssignCard q={current} onAnswer={answerBinary} {...common} />
                case 'chance-matrix': return <ChanceMatrixCard q={current} onAnswer={answerBinary} {...common} />
                default: return <QuestionCard q={current} onChoose={answerCurrent} {...common} />
              }
            })()}

            <div className="sticky-actions">
              <div className="row">
                {coach && (
                  <button className="btn small ghost" onClick={()=>setShowHelp(h=>!h)}>
                    {showHelp ? '🆘 Hjälp (aktiv)' : '🆘 Hjälp'}
                  </button>
                )}
                {!coach && current?.type === undefined && (
                  <button className="btn small ghost" onClick={()=>answerCurrent(-1)}>⏭️ Skippa</button>
                )}
                {!coach && <button className="btn small" onClick={goNext}>➡️ Nästa</button>}
                <button className="btn small" onClick={restart}>🔁 Avsluta</button>
              </div>
            </div>
          </>
        )}

        {state==='review' && current && coach && (
          <>
            <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap'}}>
              <div className="chip">Fråga {idx+1} / {questions.length}</div>
              <div className="progress" style={{flex:1, margin:'0 10px'}}><div className="bar" style={{width:`${progressPct}%`}}/></div>
              <div className="pill">👩‍🏫 Coach</div>
            </div>

            <div className="hint" style={{marginTop:10, whiteSpace:'pre-wrap', fontFamily:'ui-monospace, Menlo, Consolas, monospace'}}>
              <b>Coach:</b> {lastExplain || 'Fundera på begrepp och strategi steg för steg.'}
            </div>

            <div className="row" style={{marginTop:10}}>
              <button className="btn small" onClick={goNext}>➡️ Nästa</button>
              <button className="btn small" onClick={restart}>🔁 Avsluta</button>
            </div>
          </>
        )}

        {state==='finished' && (
          <>
            <h2>🎉 Provet klart!</h2>
            {renderSummary()}
            <div className="row" style={{marginTop:10}}>
              <button className="btn" onClick={startExam}>▶️ Gör om ({effectiveLevel}, {questionCount})</button>
              <button className="btn alt" onClick={()=>setView?.('stats')}>📊 Se statistik</button>
              <button className="btn ghost" onClick={()=>setView?.('home')}>🏠 Hem</button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  // ---- resultat-sammanfattning med svagheter per area ----
  function renderSummary(){
    if(!answers.length || !questions.length) return <p>Inga svar registrerade.</p>
    const total = answers.length
    const ok = answers.filter(a=>a.ok).length
    const pct = Math.round(100*ok/total)

    // area-agg
    const byArea = {}
    answers.forEach((a,i)=>{
      const q = questions[i]
      const area = (areaOf(q) || 'okänd')
      byArea[area] ||= {right:0, total:0}
      byArea[area].total++
      if(a.ok) byArea[area].right++
    })
    const rows = Object.entries(byArea).map(([area, s])=>({
      area, acc: s.total ? Math.round(100*s.right/s.total) : 0, total: s.total
    })).sort((x,y)=>x.acc - y.acc)

    return (
      <>
        <p><b>Resultat:</b> {ok} / {total} ({pct}%)</p>
        <div className="list" style={{marginTop:10}}>
          {rows.map(r=>(
            <div key={r.area} className="item">
              <div className="row" style={{justifyContent:'space-between'}}>
                <div><b>{r.area}</b></div>
                <div>{r.acc}% · {r.total} frågor</div>
              </div>
              <div className="progress" style={{marginTop:6}}><div className="bar" style={{width:`${r.acc}%`}}/></div>
            </div>
          ))}
        </div>
        <p className="tiny" style={{marginTop:10}}>
          Tip: Kör övningsläge med <b>Fokusera på svagheter</b> så tränar du mer på områden där du fick lägre resultat.
        </p>
      </>
    )
  }
}