// Laddar frågebank från /public/banks/*.json
// Har enkel fallback: om sessionStorage har 'customBank' används den istället.
import { useEffect, useState } from 'react'

export default function useBank(){
  const [bank, setBank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(()=>{
    let alive = true
    async function load(){
      try{
        // Använd ev. importerad custom-bank från Bank-vyn
        const custom = sessionStorage.getItem('customBank')
        if(custom){
          const obj = JSON.parse(custom)
          if(alive) setBank(obj)
          return
        }

        // Annars läs standardfilerna
        const [sv, ma] = await Promise.all([
          fetch('/banks/svenska.json').then(r=>{
            if(!r.ok) throw new Error('svenska.json saknas'); 
            return r.json()
          }),
          fetch('/banks/matematik.json').then(r=>{
            if(!r.ok) throw new Error('matematik.json saknas'); 
            return r.json()
          })
        ])

        if(!alive) return
        setBank({
          bankVersion: sv.bankVersion || '1.0',
          svenska: sv.svenska,
          matematik: ma.matematik
        })
      }catch(e){
        if(alive) setError(e)
      }finally{
        if(alive) setLoading(false)
      }
    }
    load()
    return ()=>{ alive = false }
  },[])

  return { bank, loading, error }
}