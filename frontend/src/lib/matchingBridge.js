// ESM version of matching_algorithm/ for use in the browser.
// Tag order and weights must stay in sync with matching_algorithm/vector.js.

const WEIGHTS = { genre: 2.5, era: 1.5, rating: 1.0, runtime: 0.5, language: 1.5 }

const TAG_ORDER = {
  genre:    ['action','thriller','romance','scifi','horror','comedy','drama','documentary','animation','fantasy'],
  era:      ['pre_1980s','1980s','1990s','2000s','2010s','2020s'],
  rating:   ['G','PG','PG13','R','NC17'],
  runtime:  ['under_90_min','90_to_120_min','120_to_150_min','over_150_min'],
  language: ['english','spanish','french','korean','japanese','hindi','italian','german'],
}

function toVector(profile) {
  const vec = []
  for (const [cat, tags] of Object.entries(TAG_ORDER)) {
    for (const tag of tags) {
      vec.push((profile.interestVector?.[tag] ?? 0) * WEIGHTS[cat])
    }
  }
  return vec
}

function cosine(a, b) {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  magA = Math.sqrt(magA)
  magB = Math.sqrt(magB)
  return (magA === 0 || magB === 0) ? 0 : dot / (magA * magB)
}

export function getMatches(myProfile, peers) {
  const myVec = toVector(myProfile)
  return peers
    .filter(p => p.interestVector && p.peerId !== myProfile.peerId)
    .map(p => ({ ...p, score: cosine(myVec, toVector(p)) }))
    .sort((a, b) => b.score - a.score)
}
