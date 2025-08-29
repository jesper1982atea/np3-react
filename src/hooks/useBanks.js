import { useState, useEffect, useMemo } from 'react'


export default function useBanks(){
  const [registry, setRegistry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true

    async function loadWithIndex(){
      const idx = await fetch('/banks/index.json').then(r => {
        if(!r.ok) throw new Error('index.json saknas')
        return r.json()
      })
      const banks = idx?.banks || []
      const loaded = {}
      await Promise.all(
        banks.map(async (meta) => {
          const data = await fetch(meta.path).then(r => {
            if(!r.ok) throw new Error(`Kunde inte läsa ${meta.path}`)
            return r.json()
          })
          loaded[meta.id] = { meta, data }
        })
      )
      return { version: idx.version || '1.0', banks: loaded }
    }

    async function loadFallbackTwoFiles(){
      // Ladda gamla strukturen och “låtsas” att det är två separata banker
      const [sv, ma] = await Promise.all([
        fetch('/banks/svenska.json').then(r => {
          if(!r.ok) throw new Error('svenska.json saknas')
          return r.json()
        }),
        fetch('/banks/matematik.json').then(r => {
          if(!r.ok) throw new Error('matematik.json saknas')
          return r.json()
        })
      ])

      const reg = {
        version: 'legacy-1.0',
        banks: {
          'sv-ak3': {
            meta: { id: 'sv-ak3', subject: 'svenska', grade: 3, path: '/banks/svenska.json', label: 'Svenska åk 3' },
            data: { subject: 'svenska', grade: 3, items: sv?.svenska?.items || [], passages: sv?.svenska?.passages || [] }
          },
          'ma-ak3': {
            meta: { id: 'ma-ak3', subject: 'matematik', grade: 3, path: '/banks/matematik.json', label: 'Matematik åk 3' },
            data: { subject: 'matematik', grade: 3, items: ma?.matematik?.items || [], passages: [] }
          }
        }
      }
      return reg
    }

    async function load(){
      try{
        // 1) Försök med index.json
        let reg = null
        try{
          reg = await loadWithIndex()
        }catch(_){
          // 2) Fallback till gamla två-filsläget
          reg = await loadFallbackTwoFiles()
        }
        if(!alive) return
        setRegistry(reg)
      }catch(e){
        if(alive) setError(e)
      }finally{
        if(alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [])

  const list = useMemo(() => {
    if(!registry) return []
    return Object.values(registry.banks).map(b => ({
      id: b.meta.id,
      subject: b.meta.subject,
      grade: b.meta.grade,
      label: b.meta.label
    }))
  }, [registry])

  function getBank(bankId){
    return registry?.banks?.[bankId] || null
  }

  function findBySubjectGrade(subject, grade){
    if(!registry) return null
    const entry = Object.values(registry.banks).find(b =>
      b.meta.subject === subject && Number(b.meta.grade) === Number(grade)
    )
    return entry || null
  }

  return { registry, list, getBank, findBySubjectGrade, loading, error }
}