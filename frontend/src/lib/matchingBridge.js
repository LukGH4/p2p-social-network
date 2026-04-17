import { mark } from './timing.js'

// We are setting these weights based on whuch of the categories are more important for our matching
const WEIGHTS = { genre: 2.5, era: 1.5, rating: 1.0, runtime: 0.5, language: 1.5 }

// We need to take care of the order of the tags for all the vectors to have the same exact structure
const TAG_ORDER = {
  genre:    ['action','thriller','romance','scifi','horror','comedy','drama','documentary','animation','fantasy'],
  era:      ['pre_1980s','1980s','1990s','2000s','2010s','2020s'],
  rating:   ['G','PG','PG13','R','NC17'],
  runtime:  ['under_90_min','90_to_120_min','120_to_150_min','over_150_min'],
  language: ['english','spanish','french','korean','japanese','hindi','italian','german'],
}

// This is where we make the profile into a vector so we can compare profiles to each other
function toVector(profile) {
  const vec = []
  for (const [cat, tags] of Object.entries(TAG_ORDER)) {
    for (const tag of tags) {
      vec.push((profile.tags?.[cat]?.[tag] ?? 0) * WEIGHTS[cat])
    }
  }
  return vec
}

// We use the cosine similarity to check how similar two vectors are to each other
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


// We get the matches by making our profile into the vector and then finding the similarity to all of the other peers
export function getMatches(myProfile, peers) {
  mark('matching:start', { peerCount: peers.length })
  const myVec = toVector(myProfile)
  const result = peers
    .filter(p => p.peerId !== myProfile.peerId)
    .map(p => {
      const trust = p.trust ?? {
        score: 0,
        level: 'low',
        label: 'Unverified',
        reasons: [],
        vouchCount: 0,
      }
      const compatibilityScore = cosine(myVec, toVector(p))
      const overallScore = (compatibilityScore * 0.85) + (trust.score * 0.15)

      return {
        ...p,
        score: compatibilityScore,
        overallScore,
        trust,
      }
    })
    .sort((a, b) => b.overallScore - a.overallScore)
  mark('matching:end', { peerCount: peers.length })
  return result
}
