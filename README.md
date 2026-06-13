# findyourpeer

Browser app: sign a film-taste profile, join a [libp2p](https://libp2p.io/) network over WebSockets (via a bootstrap node), gossip signed profiles and vouches, rank peers, and DM. Stack is React + Vite in `frontend/`, relay/bootstrap in `p2p/`, and a standalone Node matcher in `matching_algorithm/`.

## What’s where

- `**frontend/`** — React app, Privy auth, IndexedDB, libp2p (`network.js`, `gossipBridge.js`), signing (`profile.js`, `crypto.js`, `db.js`), trust (`trust.js`), UI. Routes in `App.jsx`: `/login`, `/account-setup`, `/profile/create`, `/feed`, `/chat/:peerId`.
- `**p2p/**` — `bootstrap.js`, `network.js`, `peer.js`, `simProfile.js`, scripts under `eval/`. Use **Node 22+** here (`p2p/package.json` `engines`).
- `**matching_algorithm/`** — Node modules for vector + cosine + `getMatches` + Jest tests (wired from the **repo root** `package.json`).
- **Root** — `npm test` runs Jest on `matching_algorithm/matching.test.js`.

## Environment setup

You need **Node.js 22+**

Install dependencies for each part of the repo before running any commands:

```bash
# root directory — needed for `npm test`
npm install

# p2p relay/bootstrap
cd p2p && npm install

# React frontend
cd frontend && npm install
```

Each directory has its own `package.json` and `node_modules`; you must install in all three independently.

## Env

Put real values in `**frontend/.env.local`** (restart Vite after edits):

```
VITE_PRIVY_APP_ID=<Privy dashboard>
VITE_BOOTSTRAP_ADDR=/ip4/127.0.0.1/tcp/4012/ws
```

If you omit `**VITE_BOOTSTRAP_ADDR**`, the client falls back to `127.0.0.1:4012` (`gossipBridge.js`).

## Run locally

1. One machine runs the relay (**TCP 4012** for WS):
  ```bash
   cd p2p && npm install && npm run bootstrap
  ```
   Keep the websocket multiaddr from the log if you’ll paste it into env.
2. Another terminal, the SPA:
  ```bash
   cd frontend && npm install && npm run dev
  ```
   Hit the URL Vite prints (often `http://localhost:5173`), sign in, finish onboarding; `**/feed**` is matches, `**/chat/:peerId**` DMs.

## Multi-laptop demo

Use **one laptop only** as the bootstrap: run `**npm run bootstrap`** there and grab its websocket multiaddr (`/ip4/<that-machine’s-LAN-ip>/tcp/4012/ws/…`).

On **every client machine** that should join that swarm, edit `**frontend/.env.local`** and set `VITE_BOOTSTRAP_ADDR` to that multiaddr, that’s all you change. Restart `npm run dev`. 

Machines must reach that host/port on the LAN (or however you routed it).

## Matching algorithm

Code lives under `**matching_algorithm/**` (standalone Node path). In the SPA the same cosine idea (+ category weights + trust blending) ships in `**frontend/src/lib/matchingBridge.js**`; keep weights and tag ordering in sync with `**vector.js**`.

### Files


| File               | Role                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `vector.js`        | Tag order per category, multiply by weights, concatenate into one vector (“schema + profile → vector”). |
| `similarity.js`    | Cosine similarity between vectors.                                                                      |
| `matching.js`      | `**getMatches(myProfile, arrayOfPeerProfiles)**` — filters invalid/self, scores rest, sorts high → low. |
| `matching.test.js` | Jest tests.                                                                                             |


### Usage

```js
const { getMatches } = require('./matching.js');
// returns [{ peerId, username, score }, ...] best first (score = cosine similarity)
```

### Profile shape (`matching_algorithm/`)

Peers need `**peerId**`, `**username**`, `**tags**` (nested by category). Untagged dims behave as zeros when building vectors.

```js
{
  peerId: 'peerIdValue',
  username: 'peerUsername',
  tags: {
    genre: { scifi: 1, action: 1 },
    era: { '2010s': 1 },
    rating: { R: 1 },
    runtime: { '90_to_120_min': 1 },
    language: { english: 1 }
  }
}
```

### Running tests

From the **repository root** (Jest picks up `**matching_algorithm/`**):

```bash
npm install
npm test
```

There isn’t a separate `package.json` inside `**matching_algorithm/**`; dependencies for tests resolve from the root.

## Identity & profile management (Anvesha Mongia)

Creates and signs profiles locally, persists keys/metadata in IndexedDB, and hands `**SignedProfile**` objects to `**gossipBridge.js**` so they can fan out.

### Files


| File                          | What it does                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `frontend/src/lib/profile.js` | `**createProfile**`, `**signProfile**`, `**verifyProfile**`, `**isProfileExpired**`, `**getStoredProfile**`, etc. |
| `frontend/src/lib/crypto.js`  | Web Crypto (ECDSA P-256 keygen, sign, verify)—no JS crypto libs besides the browser API.                          |
| `frontend/src/lib/db.js`      | IndexedDB via **idb**: keypairs + profiles.                                                                       |


### `SignedProfile` shape (network)

```js
{
  peerId: 'string',
  username: 'string',
  bio: 'string',
  tags: {
    genre:    { scifi: 1, action: 0.5 },
    era:      { '2010s': 1 },
    rating:   { R: 1 },
    runtime:  { '90_to_120_min': 1 },
    language: { english: 1 }
  },
  publicKey: 'base64-spki',
  signature: 'base64',
  timestamp: 1712345678000,
  ttl: 3600000
}
```

(libp2p assigns `**peerId**`; omitted tags behave as unrated/zero where applicable.)

### How it behaves

First profile creation generates an ECDSA P-256 pair with `**crypto.subtle**`, keeps the **private key non-extractable** in IndexedDB, and embeds the **public key** so peers verify without a central registrar.

Signing uses a deterministic JSON stringify (sorted keys) over everything except `**signature`**. Receiving peers call `**verifyProfile**`.

`**isProfileExpired**` compares `**timestamp + ttl**` against `**Date.now()**`; gossip caches or drops stale payloads accordingly.

Auth is **[Privy](https://privy.io/)** (email, OAuth, SMS, etc.), sessions only, no wallet requirement.

On top of that there’s peer **vouching**: sign vouches, verify inbound ones, store them locally, gossip them beside profiles, reject bad/expired packets, derive a trust score, then **blend trust into rankings** (`**overallScore`** in `**matchingBridge.js**` is roughly `**0.85 × taste + 0.15 × trust**`—exact constants in code).

Canonical tag lists: `**frontend/src/schema/interestSchema.js**`. Category weights (genre 2.5, era 1.5, rating 1.0, runtime 0.5, language 1.5) match `**vector.js**` / `**matchingBridge.js**`.

## P2P benchmarks (`p2p/eval/`)

Scripts live on the `evaluations` remote branch (named `eval`). Fetch and check out before running:

```bash
git fetch origin
git checkout evaluations
cd p2p && npm install
```


| Script                    | Runs                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `npm run bootstrap`       | Relay / bootstrap                                                             |
| `npm run peer`            | `src/peer.js` — pass bootstrap multiaddr + name                               |
| `npm run eval1` … `eval4` | `eval/eval1_matching.js` … `eval4_discovery.js`                               |
| `npm run demo:100`        | `eval/demo_100_peers.js`                                                      |
| `npm run demo:gossip`     | `eval/demo_gossip_100.js` — tune `**TOTAL**`, `**SEND_GAP_MS**`, etc. in file |


Scripts that need a bootstrap multiaddr usually take `**process.argv[2]**`. `**eval1**` imports `**frontend/src/lib/matchingBridge.js**` so timings match production. `**eval/helpers.js**` has `**makeProfile**` and friends.

You might see `**NO_RESERVATION**` relay noise on one box; peers often still connect.

### `demo:100` + ngrok

Local-only runs: point everything at `**127.0.0.1**` / LAN—**no tunnel**.

`**ngrok tcp 4012`** is for when the bootstrap has to be dialed from **outside** your LAN (e.g. public multiaddr). Start `**npm run bootstrap`**, run `**ngrok tcp 4012**`, turn the forwarding line into a `**/dns4/.../tcp/.../ws**` multiaddr, then:

```bash
cd p2p && npm run demo:100 -- '/dns4/example.tcp.ngrok.io/tcp/12345/ws'
```

Optional **2nd** arg: stats URL (default `**http://127.0.0.1:4013/stats`**, `**STATS_PORT**` in `**bootstrap.js**`).

## Lint

```bash
cd frontend && npm run lint
```

