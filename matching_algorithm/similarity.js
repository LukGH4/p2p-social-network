function calculatingCosineSimilarity(firstVector, secondVector) {

    var firstVectorLength = firstVector.length;
    var secondVectorLength = secondVector.length;

    if (firstVectorLength !== secondVectorLength) {
        return 0;
    }

    var dotProductValue;
    dotProductValue = 0;

    for (var i = 0; i < firstVectorLength; i++) {
        dotProductValue = dotProductValue + (firstVector[i] * secondVector[i]);
    }

    var sumOfSquaresA = 0;
    for (var i = 0; i < firstVectorLength; i++) {
        sumOfSquaresA = sumOfSquaresA + (firstVector[i] * firstVector[i]);
    }

    var magAValue = Math.sqrt(sumOfSquaresA);

    var sumOfSquaresB = 0;
    for (var i = 0; i < secondVectorLength; i++) {
        sumOfSquaresB = sumOfSquaresB + (secondVector[i] * secondVector[i]);
    }

    var magBValue = Math.sqrt(sumOfSquaresB);


    if (magAValue === 0 || magBValue === 0) {
        return 0;
    } else {
        var cosineSimilarityScore = dotProductValue / (magAValue * magBValue);
        return cosineSimilarityScore;
    }
}

module.exports = { calculatingCosineSimilarity };