# cs4675-findyourpeer

## Matching Algorithm (Ved Srivathsa)

### Files:

- `vector.js`: Schema definition and the profile to vector conversion implementation
- `similarity.js`: Cosine similarity math implementations
- `matching.js`: Includes the getMatches function to retrieve the matches
- `matching.test.js`: Includes unit tests to ensure proper functionality of the matching algorithm

### Usage:

- Import the `getMatches` function from `matching.js` and pass your profile and array of peer profiles as an argument
- Returns list of peers from highest to lowest match score (contain peer ID, username, match score)

### Profile: 

Profile objects have the following format:

```js
{
    peerId: 'peerIdValue',
    username: 'peerUsername',
    tags: {
        genre: {scifi: 1, action: 1},
        era: {'2010s': 1},
        rating: {R: 1}
        runtime: {'90_to_120_min': 1},
        language: {english: 1}
    }
}
```

### Running Tests:

- cd into the matching algorithm folder
- Run `npm install`
- Run `npm test`