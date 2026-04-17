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


    // GENRE

    for (var i = 0; i < GENRE_TAGS.length; i++) {
        var currentGenreTag = GENRE_TAGS[i];
        // If we dont have a profile tag when we set the value to 0
        var userGenreValue = profile.tags.genre[currentGenreTag] || 0;
        // We are making the vector with the weights applied
        fullVector.push(userGenreValue * CATEGORY_WEIGHTS.genre);
    }


    // ERA

    for (var i = 0; i < ERA_TAGS.length; i++) {
        var currentEraTag = ERA_TAGS[i];
        var userEraValue = profile.tags.era[currentEraTag] || 0;
        fullVector.push(userEraValue * CATEGORY_WEIGHTS.era);
    }


    // RATING

    for (var i = 0; i < RATING_TAGS.length; i++) {
        var currentRatingTag = RATING_TAGS[i];
        var userRatingValue = profile.tags.rating[currentRatingTag] || 0;
        fullVector.push(userRatingValue * CATEGORY_WEIGHTS.rating);
    }


    // RUNTIME

    for (var i = 0; i < RUNTIME_TAGS.length; i++) {
        var currentRuntimeTag = RUNTIME_TAGS[i];
        var userRuntimeValue = profile.tags.runtime[currentRuntimeTag] || 0;
        fullVector.push(userRuntimeValue * CATEGORY_WEIGHTS.runtime);
    }


    // LANGUAGE

    for (var i = 0; i < LANGUAGE_TAGS.length; i++) {
        var currentLanguageTag = LANGUAGE_TAGS[i];
        var userLanguageValue = profile.tags.language[currentLanguageTag] || 0;
        fullVector.push(userLanguageValue * CATEGORY_WEIGHTS.language);
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
