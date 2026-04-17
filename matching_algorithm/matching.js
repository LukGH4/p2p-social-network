const { convertProfileToVector } = require('./vector');
const { calculatingCosineSimilarity } = require('./similarity');

function getMatches(myProfile, arrayOfPeerProfiles) {
    
    var myVector = convertProfileToVector(myProfile);
    var arrayOfMatchResults = [];

    for (var i = 0; i < arrayOfPeerProfiles.length; i++) {
        var currentPeerProfile = arrayOfPeerProfiles[i];


        // We dont want to consider any of the peer profiles which are invalid or its own profile
        if (!currentPeerProfile.tags) {
            continue;
        }
        
        if (currentPeerProfile.peerId === myProfile.peerId) {
            continue;
        }

        var currentPeerVector = convertProfileToVector(currentPeerProfile);

        // We are finding the similarity score values by calling the cosine similarity function
        var similarityScore = calculatingCosineSimilarity(myVector, currentPeerVector);

        var matchResult = {
            peerId: currentPeerProfile.peerId,
            username: currentPeerProfile.username,
            score: similarityScore
        };

        arrayOfMatchResults.push(matchResult);
    }


    // We want to sort the results from the best score to the worst score
    for (var i = 0; i < arrayOfMatchResults.length; i++) {
        for (var j = i + 1; j < arrayOfMatchResults.length; j++) {
            if (arrayOfMatchResults[j].score > arrayOfMatchResults[i].score) { 
                var temp = arrayOfMatchResults[i];
                arrayOfMatchResults[i] = arrayOfMatchResults[j];
                arrayOfMatchResults[j] = temp;
            }
        }
    }

    return arrayOfMatchResults;

}

module.exports = { getMatches };