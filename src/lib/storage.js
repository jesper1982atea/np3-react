export function loadProfile(){
  const DEF = {
    points:0, level:1, badges:[],
    settings:{
      perQuiz:10, perExam:20,
      perQuestionTimerSec:45, examTimerTotalMin:25,
      noRepeats: true // ⬅️ NYTT: undvik upprepning mellan omgångar
    },
    stats:{ svenska:{answered:0,correct:0}, matematik:{answered:0,correct:0} }
  };
  try{
    const s = SafeStore.get(); if(!s) return DEF;
    return {
      ...DEF,
      ...s,
      settings:{...DEF.settings, ...(s.settings||{})},
      stats:{
        svenska:{...DEF.stats?.svenska, ...(s.stats?.svenska||{})},
        matematik:{...DEF.stats?.matematik, ...(s.stats?.matematik||{})}
      }
    }
  }catch(e){ return DEF; }
}