const ERA_TAGS = [
    'pre_1980s',
    '1980s',
    '1990s',
    '2000s',
    '2010s',
    '2020s',
];

const RATING_TAGS = [
    'G',
    'PG',
    'PG13',
    'R',
    'NC17'
];

const GENRE_TAGS = [
    'action',
    'thriller',
    'romance',
    'scifi',
    'horror',
    'comedy',
    'drama',
    'documentary',
    'animation',
    'fantasy'
];

const RUNTIME_TAGS = [
    'under_90_min',
    '90_to_120_min',
    '120_to_150_min',
    'over_150_min'
];

const LANGUAGE_TAGS = [
    'english',
    'spanish',
    'french',
    'korean',
    'japanese',
    'hindi',
    'italian',
    'german'
];


const CATEGORY_WEIGHTS = {
    genre: 2.5,
    era: 1.5,
    rating: 1.0,
    runtime: 0.5,
    language: 1.5
}

function convertProfileToVector(profile) {
    var fullVector = [];
    var iv = profile.interestVector || {};


    // GENRE

    for (var i = 0; i < GENRE_TAGS.length; i++) {
        var weightedGenreValue = (iv[GENRE_TAGS[i]] || 0) * CATEGORY_WEIGHTS.genre;
        fullVector.push(weightedGenreValue);
    }


    // ERA

    for (var i = 0; i < ERA_TAGS.length; i++) {
        var weightedEraValue = (iv[ERA_TAGS[i]] || 0) * CATEGORY_WEIGHTS.era;
        fullVector.push(weightedEraValue);
    }


    // RATING

    for (var i = 0; i < RATING_TAGS.length; i++) {
        var weightedRatingValue = (iv[RATING_TAGS[i]] || 0) * CATEGORY_WEIGHTS.rating;
        fullVector.push(weightedRatingValue);
    }


    // RUNTIME

    for (var i = 0; i < RUNTIME_TAGS.length; i++) {
        var weightedRuntimeValue = (iv[RUNTIME_TAGS[i]] || 0) * CATEGORY_WEIGHTS.runtime;
        fullVector.push(weightedRuntimeValue);
    }


    // LANGUAGE

    for (var i = 0; i < LANGUAGE_TAGS.length; i++) {
        var weightedLanguageValue = (iv[LANGUAGE_TAGS[i]] || 0) * CATEGORY_WEIGHTS.language;
        fullVector.push(weightedLanguageValue);
    }

    return fullVector;
}

module.exports = {
    convertProfileToVector,
    GENRE_TAGS,
    ERA_TAGS,
    RATING_TAGS,
    RUNTIME_TAGS,
    LANGUAGE_TAGS,
    CATEGORY_WEIGHTS
};