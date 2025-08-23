// src/lib/coach.js
// Samlar/lagrar historik per ämne/area, räknar svagheter, ger vikter

const CAP = 200; // behåll senaste 200 utfall per area

export function areaOf(q){
  // harmonisera area-nyckeln lite
  const area = (q?.area || '').toLowerCase();
  if(!area && q?.title && q?.text) return 'läsförståelse';
  return area || 'okänd';
}

/**
 * Logga ett svar för adaptiv träning
 * topic: 'svenska' | 'matematik'
 * q: frågeobjekt (behöver .area)
 * ok: boolean
 */
export function recordOutcome(topic, q, ok){
  try{
    const area = areaOf(q);
    const key = `hist_${topic}_${area}`;
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push(!!ok);
    localStorage.setItem(key, JSON.stringify(arr.slice(-CAP)));
    // Även total per topic (för din befintliga adapt-logik)
    const keyTopic = `hist_${topic}`;
    const tarr = JSON.parse(localStorage.getItem(keyTopic) || '[]');
    tarr.push(!!ok);
    localStorage.setItem(keyTopic, JSON.stringify(tarr.slice(-CAP)));
  }catch(e){}
}

/**
 * Rolling accuracy 0..1 på en bool-array (true=rätt)
 */
export function accuracy(arr, window=50){
  if(!arr || !arr.length) return null;
  const slice = arr.slice(-window);
  const n = slice.length;
  if(!n) return null;
  const ok = slice.reduce((s,v)=>s+(v?1:0),0);
  return ok / n;
}

/**
 * Bygg vikter per area där lägre träff% ger högre vikt (mer träning).
 * Returnerar t.ex. { addition:1.6, subtraktion:1.3, ... } (normaliserade så att medel≈1).
 */
export function weaknessWeights(topic, allAreas, window=50){
  const accs = {};
  for(const area of allAreas){
    try{
      const key = `hist_${topic}_${area.toLowerCase()}`;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      accs[area] = accuracy(arr, window);
    }catch(e){
      accs[area] = null;
    }
  }
  // Basvikt = 1.0. Saknad data -> 1.0
  const raw = {};
  for(const area of allAreas){
    const a = accs[area];
    // Mappa accuracy -> vikt: vikt = 1 + (0.5 - a) * 1.2 , clamp [0.5, 2]
    const w = a==null ? 1.0 : Math.max(0.5, Math.min(2.0, 1 + (0.5 - a) * 1.2));
    raw[area] = w;
  }
  // Normalisera: skala så att medel ~ 1
  const ws = Object.values(raw);
  const mean = ws.reduce((s,v)=>s+v,0) / (ws.length || 1);
  const norm = {};
  for(const k of Object.keys(raw)){
    norm[k] = raw[k] / (mean || 1);
  }
  return norm;
}