// Movie interest schema — tag keys must match matching_algorithm/vector.js exactly

export const INTEREST_SCHEMA = {
  genre: {
    label: 'Genre',
    tags: {
      action:      'Action',
      thriller:    'Thriller',
      romance:     'Romance',
      scifi:       'Sci-Fi',
      horror:      'Horror',
      comedy:      'Comedy',
      drama:       'Drama',
      documentary: 'Documentary',
      animation:   'Animation',
      fantasy:     'Fantasy',
    },
  },
  era: {
    label: 'Era',
    tags: {
      pre_1980s: 'Pre-1980s',
      '1980s':   '80s',
      '1990s':   '90s',
      '2000s':   '2000s',
      '2010s':   '2010s',
      '2020s':   '2020s',
    },
  },
  rating: {
    label: 'Rating',
    tags: {
      G:    'G',
      PG:   'PG',
      PG13: 'PG-13',
      R:    'R',
      NC17: 'NC-17',
    },
  },
  runtime: {
    label: 'Runtime',
    tags: {
      under_90_min:     'Under 90 min',
      '90_to_120_min':  '90–120 min',
      '120_to_150_min': '120–150 min',
      over_150_min:     'Over 150 min',
    },
  },
  language: {
    label: 'Language',
    tags: {
      english:  'English',
      spanish:  'Spanish',
      french:   'French',
      korean:   'Korean',
      japanese: 'Japanese',
      hindi:    'Hindi',
      italian:  'Italian',
      german:   'German',
    },
  },
}

// Returns an empty { genre: [], era: [], ... } map
export function emptyTags() {
  return Object.fromEntries(Object.keys(INTEREST_SCHEMA).map(c => [c, []]))
}

// Converts { genre: ['action', 'scifi'], era: ['2010s'], ... }
// to the format getMatches() expects: { genre: { action: 1, scifi: 1 }, ... }
export function tagsToProfile(selected) {
  const result = {}
  for (const category of Object.keys(INTEREST_SCHEMA)) {
    result[category] = {}
    for (const tag of (selected[category] || [])) {
      result[category][tag] = 1
    }
  }
  return result
}

// Reverse of tagsToProfile — used when loading a saved profile for editing
export function profileToTags(profileTags) {
  const result = {}
  for (const category of Object.keys(INTEREST_SCHEMA)) {
    result[category] = Object.keys(profileTags[category] || {})
  }
  return result
}
