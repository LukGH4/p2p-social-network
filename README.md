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

---

## Identity & Profile Management (Anvesha Mongia)

### Overview

Handles profile creation, keypair-based identity, local storage, and profile signing/verification. Produces a `SignedProfile` that is handed off to the gossip layer (Part 3) for broadcast.

### Files

- `frontend/src/lib/profile.js` — core profile API: `createProfile`, `signProfile`, `verifyProfile`, `isProfileExpired`, `getStoredProfile`
- `frontend/src/lib/crypto.js` — Web Crypto API wrappers: keypair generation, signing, verification (ECDSA P-256, no external libraries)
- `frontend/src/lib/db.js` — IndexedDB storage via `idb`: profile store and keypair store

### Profile Format

All profiles on the network are `SignedProfile` objects:

```js
{
  peerId: 'string',          // assigned by libp2p (Part 1)
  username: 'string',
  bio: 'string',
  tags: {                    // nested by category — omitted tags default to 0
    genre:    { scifi: 1, action: 0.5 },
    era:      { '2010s': 1 },
    rating:   { R: 1 },
    runtime:  { '90_to_120_min': 1 },
    language: { english: 1 }
  },
  publicKey: 'base64',       // ECDSA P-256 public key (SPKI format)
  signature: 'base64',       // signs everything except this field
  timestamp: 1712345678000,  // unix ms — set at broadcast time
  ttl: 3600000               // ms — 1 hour default
}
```

### How It Works

1. On first profile creation, an ECDSA P-256 keypair is generated via `window.crypto.subtle` and stored in IndexedDB. The private key is non-extractable — it never leaves the browser.
2. The public key is embedded in the profile as a base64 string so peers can verify signatures without any central authority.
3. The profile payload (all fields except `signature`) is serialized with sorted keys for determinism, then signed with the private key.
4. Any peer receiving a profile can call `verifyProfile` to confirm it was signed by the holder of the matching private key.
5. `isProfileExpired` checks `Date.now() > timestamp + ttl` — Part 3 uses this to decide whether to cache or drop an incoming profile.

### Authentication

- Integrated [Privy](https://privy.io) for user authentication (email, SMS, Google, Apple, and more).
- Privy handles session management; no Ethereum wallets or ENS names are required.
- Added a peer-vouching system where users can vouch for other peers instead of relying on a centralized identity authority.
- Signed each vouch cryptographically and verified incoming vouches before accepting them.
- Stored vouches locally in IndexedDB so trust state persists across refreshes.
- Updated the gossip layer to propagate both signed profiles and signed trust vouches across the P2P network.
- Rejected invalid or expired profiles.
- Computed a trust score from verified peer vouches.
- Blended trust score into match ranking so peers are ordered by both taste similarity and trust.

### Running Locally

```bash
cd frontend
npm install
npm run dev
```