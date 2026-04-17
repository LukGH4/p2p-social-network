function calculatingCosineSimilarity(firstVector, secondVector) {

    var firstVectorLength = firstVector.length;
    var secondVectorLength = secondVector.length;

    // If the vectors are not compatible with each other then we return 0
    if (firstVectorLength !== secondVectorLength) {
        return 0;
    }

    var dotProductValue;
    dotProductValue = 0;

    for (var i = 0; i < firstVectorLength; i++) {
        // Finding the dot product result
        dotProductValue = dotProductValue + (firstVector[i] * secondVector[i]);
    }

    var sumOfSquaresA = 0;
    for (var i = 0; i < firstVectorLength; i++) {
        sumOfSquaresA = sumOfSquaresA + (firstVector[i] * firstVector[i]);
    }

    // Finding the magnitude value
    var magAValue = Math.sqrt(sumOfSquaresA);

    var sumOfSquaresB = 0;
    for (var i = 0; i < secondVectorLength; i++) {
        sumOfSquaresB = sumOfSquaresB + (secondVector[i] * secondVector[i]);
    }

    // Finding the magnitude value
    var magBValue = Math.sqrt(sumOfSquaresB);


    // This check was added to make sure that we arent doing any division by 0
    if (magAValue === 0 || magBValue === 0) {
        return 0;
    } else {
        var cosineSimilarityScore = dotProductValue / (magAValue * magBValue);
        return cosineSimilarityScore;
    }
}

module.exports = { calculatingCosineSimilarity };