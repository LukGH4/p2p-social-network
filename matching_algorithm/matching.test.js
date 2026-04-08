const { convertProfileToVector } = require('./vector');
const { calculatingCosineSimilarity } = require('./similarity');
const { getMatches } = require('./matching');


// Test 1: Identical profiles score

test('Identical Profiles, Expected Score: 1', function() {
    var profileA = {
        peerId: 'peer1',
        username: 'peer1username',
        interestVector: { scifi: 1, thriller: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var profileB = {
        peerId: 'peer2',
        username: 'peer2username',
        interestVector: { scifi: 1, thriller: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var vecA = convertProfileToVector(profileA);
    var vecB = convertProfileToVector(profileB);
    var similarityResult = calculatingCosineSimilarity(vecA, vecB);

    expect(similarityResult).toBeCloseTo(1.0);
});


//Test 2: Far Apart Profiles

test('Very Different Profiles, Expected Score: Low', function() {
    var profileA = {
        peerId: 'peer3',
        username: 'peer3username',
        interestVector: { scifi: 1, action: 1, '2010s': 1, R: 1, over_150_min: 1, korean: 1 }
    };

    var profileB = {
        peerId: 'peer4',
        username: 'peer4username',
        interestVector: { romance: 1, comedy: 1, '1990s': 1, PG: 1, under_90_min: 1, french: 1 }
    };

    var vecA = convertProfileToVector(profileA);
    var vecB = convertProfileToVector(profileB);
    var similarityResult = calculatingCosineSimilarity(vecA, vecB);

    expect(similarityResult).toBeLessThan(0.2);
});

//Test 3: Empty Profile

test('Empty Profile, Expected Score: 0', function() {
    var profileA = {
        peerId: 'peer5',
        username: 'peer5username',
        interestVector: { scifi: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var profileB = {
        peerId: 'peer6',
        username: 'peer6username',
        interestVector: {}
    };

    var vecA = convertProfileToVector(profileA);
    var vecB = convertProfileToVector(profileB);
    var similarityResult = calculatingCosineSimilarity(vecA, vecB);

    expect(similarityResult).toBe(0);
});


//Test 4: Own Profile in Match Results

test('Own Profile Should Not Be In Results', function() {
    var profileA = {
        peerId: 'peer7',
        username: 'peer7username',
        interestVector: { scifi: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var profileB = {
        peerId: 'peer8',
        username: 'peer8username',
        interestVector: { scifi: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var matchesResult = getMatches(profileA, [profileA, profileB]);
    var matchFoundSelf = false;
    for (var i = 0; i < matchesResult.length; i++) {
        if (matchesResult[i].peerId === 'peer7') {
            matchFoundSelf = true;
        }
    }

    expect(matchFoundSelf).toBe(false);
});


//Test 5: Correct Sorting of Results

test('Higher scores displayed before lower scores', function() {
    var profileA = {
        peerId: 'peer9',
        username: 'peer9username',
        interestVector: { scifi: 1, thriller: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var profileB = {
        peerId: 'peer10',
        username: 'peer10username',
        interestVector: { scifi: 1, thriller: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var profileC = {
        peerId: 'peer11',
        username: 'peer11username',
        interestVector: { romance: 1, '1980s': 1, G: 1, under_90_min: 1, french: 1 }
    };

    var matchesResult = getMatches(profileA, [profileB, profileC]);
    var strongResult = matchesResult[0];
    var weakResult = matchesResult[1];
    expect(strongResult.username).toBe('peer10username');
    expect(weakResult.username).toBe('peer11username');
});


// Test 6: Skipping peers with no interestVector

test('Skipping peers with no interestVector', function() {
    var profileA = {
        peerId: 'peer12',
        username: 'peer12username',
        interestVector: { scifi: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var profileB = {
        peerId: 'peer13',
        username: 'peer13username',
    };

    var matchesResult = getMatches(profileA, [profileB]);
    expect(matchesResult.length).toBe(0);
});


//Test 7: Middle scores for partial similarities

test('Profiles with Moderate Overlap, Expected Score: Medium', function() {
    var profileA = {
        peerId: 'peer14',
        username: 'peer14username',
        interestVector: { scifi: 1, thriller: 1, romance: 1, '2010s': 1, R: 1, '90_to_120_min': 1, english: 1 }
    };

    var profileB = {
        peerId: 'peer15',
        username: 'peer15username',
        interestVector: { scifi: 1, horror: 1, romance: 1, '2000s': 1, PG13: 1, '90_to_120_min': 1, english: 1 }
    };

    var vecA = convertProfileToVector(profileA);
    var vecB = convertProfileToVector(profileB);
    var similarityResult = calculatingCosineSimilarity(vecA, vecB);

    expect(similarityResult).toBeGreaterThan(0);
    expect(similarityResult).toBeLessThan(1);
});
