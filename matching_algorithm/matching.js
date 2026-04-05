const { convertProfileToVector } = require('./vectors');
const { calculatingCosineSimilarity } = require('./similarity');

function getMatches(myProfile, arrayOfPeerProfiles) {
    var myVector = convertProfileToVector(myProfile);
    var arrayOfMatchResults = [];

    for (var i = 0; i < arrayOfPeerProfiles.length; i++) {
        var currentPeerProfile = arrayOfPeerProfiles[i];

        if (!currentPeerProfile.tags) {
            continue;
        }
        
        if (currentPeerProfile.peerId === myProfile.peerId) {
            continue;
        }

        var currentPeerVector = convertProfileToVector(currentPeerProfile);
        var similarityScore = calculatingCosineSimilarity(myVector, currentPeerVector);

        var matchResult = {
            peerId: currentPeerProfile.peerId,
            username: currentPeerProfile.username,
            score: similarityScore
        };

        arrayOfMatchResults.push(matchResult);
    }

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