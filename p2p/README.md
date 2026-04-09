# Part 1 P2P Infrastructure

- `src/bootstrap.js`: relay/bootstrap node for local or cloud use
- `src/network.js`: reusable wrapper exposing `start()`, `sendToNetwork(payload)`, `onMessage(callback)`, and `getConnectedPeers()`
- `src/peer.js`: local peer runner for validation

## Install

```bash
cd p2p
npm install
```

Use Node.js `22+`. The libp2p packages installed here rely on runtime features that are not present in the older `/usr/local/bin/node` on this machine.

## Run Locally

Terminal 1:

```bash
npm run bootstrap
```

Copy the printed websocket multiaddr, which will look like:

```text
/ip4/127.0.0.1/tcp/4012/ws/p2p/<BOOTSTRAP_PEER_ID>
```

Terminal 2:

```bash
node src/peer.js /ip4/127.0.0.1/tcp/4012/ws/p2p/<BOOTSTRAP_PEER_ID> A
```

Terminal 3:

```bash
node src/peer.js /ip4/127.0.0.1/tcp/4012/ws/p2p/<BOOTSTRAP_PEER_ID> B
```

Expected result:

- both peers print a peer ID
- both peers print at least one relayed listen address
- `connected peers` begins showing the other peer
- peer A logs payloads from peer B
- peer B logs payloads from peer A

## Cloud Bootstrap Node

Run `src/bootstrap.js` on a small VM and open TCP port `4012`. Use the VM's public websocket multiaddr as the bootstrap address for local peers.

## Notes

- This uses relay-backed discovery through the bootstrap node, which is enough for the assignment milestone.
- `sendToNetwork(payload)` broadcasts to currently known peers.

-- Local Testing Quirk: When testing multiple peers on the same local network or machine (like multiple terminal windows or browser tabs), you may see a warning like: failed to connect to <PEER_ID>: failed to connect via relay with status NO_RESERVATION. This is completely safe to ignore. It simply means the bootstrap node's anti-spam limits rejected multiple circuit reservations from the same local IP. Your peers will still successfully find and connect to each other via the fallback discovery proto