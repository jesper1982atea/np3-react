// src/lib/bankUtils.js
/**
 * Normaliserar en bank till:
 * { subject, grade, items:[], passages:[] }
 * Stödjer:
 *  - Nya single-subject banker: {subject, grade, items, passages?}
 *  - (Fallback) gamla formatet: {svenska:{items,passages?}} eller {matematik:{items}}
 *    -> då behöver du ange subjectHint ('svenska' | 'matematik').
 */
export function normalizeBank(raw, subjectHint) {
  if (!raw) return null;

  // Ny bank
  if (raw.subject && Array.isArray(raw.items)) {
    return {
      subject: raw.subject,
      grade: raw.grade ?? null,
      items: raw.items || [],
      passages: raw.passages || []
    };
  }

  // Fallback gamla
  if (raw.svenska || raw.matematik) {
    const part = subjectHint === 'matematik' ? raw.matematik : raw.svenska;
    if (!part) return null;
    return {
      subject: subjectHint || 'svenska',
      grade: null,
      items: part.items || [],
      passages: part.passages || []
    };
  }

  // Okänt format
  return null;
}