# Multi-laptop demo (FindYourPeer)

Follow these steps so **everyone’s browser** joins the **same** P2P network. The critical piece is **one shared bootstrap node** reachable on **TCP port 4012**, and each laptop’s frontend must point at it via **`VITE_BOOTSTRAP_ADDR`**.

---

## Prerequisites

- **Node.js 22+** on each laptop (`node -v`).
- All machines on the **same Wi‑Fi** (typical classroom), *or* a **cloud VM** with a public IP if people are not on the same LAN.
- Repo cloned on each laptop: `git clone …` and `git pull` before the demo.

---

## Step 1 — Pick the “bootstrap” laptop

One person runs **only** the bootstrap server (lightweight; can be the presenter’s machine).

1. Open a terminal on that laptop.
2. `cd p2p`
3. `npm install`
4. `npm run bootstrap`
5. Leave it running. You should see something like `BOOTSTRAP NODE STARTED` and `Listening on:` with an address using port **4012**.

---

## Step 2 — Find that laptop’s IP address

Others need this IP to connect (not `127.0.0.1` — that means “this machine only”).

- **macOS:** System Settings → Network → Wi‑Fi → Details → IP address, or run `ipconfig getifaddr en0` (Wi‑Fi interface name may vary).
- **Windows:** `ipconfig` → Wireless LAN adapter → IPv4.
- **Linux:** `ip a` or `hostname -I`.

Example LAN IP: `192.168.1.50`.

---

## Step 3 — Allow port 4012 through the firewall (bootstrap laptop only)

The bootstrap machine must **accept inbound TCP 4012** from other laptops on the Wi‑Fi.

- **macOS:** System Settings → Network → Firewall → Options → allow incoming for `node`, or temporarily turn off the firewall for the demo.
- **Windows:** Allow Node.js or add an inbound rule for TCP 4012.

If this step is skipped, other laptops will show a network / bootstrap error in the app.

---

## Step 4 — Configure every laptop’s frontend to use that IP

On **each** laptop (including the bootstrap laptop if it also runs the UI):

1. `cd frontend`
2. `npm install`
3. Copy the example env file and edit it:

   ```bash
   cp .env.example .env.local
   ```

4. Edit **`frontend/.env.local`** and set (use **your** bootstrap IP):

   ```bash
   VITE_BOOTSTRAP_ADDR=/ip4/192.168.1.50/tcp/4012/ws
   ```

   Replace `192.168.1.50` with the IP from Step 2.  
   Format is always: `/ip4/<IP>/tcp/4012/ws` (no `http://`).

5. **Restart** `npm run dev` after changing `.env.local` (Vite reads env at startup).

**Same bootstrap laptop also using the app:** Use the same line in `.env.local`, with that machine’s own LAN IP (not `127.0.0.1`), so everyone—including you—uses one consistent address.

---

## Step 5 — Run the frontend on each laptop

On **each** laptop:

1. `cd frontend`
2. `npm run dev`
3. Open **`http://localhost:5173`** in the browser.

Use **localhost** for the URL so **Web Crypto** (profile signing) stays in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). Do not load the app from another laptop’s `http://192.x.x.x:5173` unless you switch to HTTPS—signing may fail.

---

## Step 6 — Demo flow

1. Ensure **`npm run bootstrap`** is still running on the bootstrap laptop.
2. Each person: **Get Started** → create profile (pick tags) → land on **Match Feed**.
3. Wait a few seconds; peer lists update as gossip runs (periodic refresh / broadcasts).
4. Open **Connect** on a match → **Chat** and send messages both ways.

---

## Remote / different networks (optional)

If people are **not** on the same Wi‑Fi:

1. Run `npm run bootstrap` on a small **cloud VM** (or any host with a **public IP**).
2. Open **TCP 4012** in the cloud security group / firewall.
3. Set on every laptop:

   `VITE_BOOTSTRAP_ADDR=/ip4/<PUBLIC_IP>/tcp/4012/ws`

---

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| “Network error — is the bootstrap running?” | Bootstrap terminal crashed; wrong IP; firewall blocking 4012; typo in multiaddr. |
| Only localhost works | `VITE_BOOTSTRAP_ADDR` still `127.0.0.1` on other laptops — must be bootstrap laptop’s LAN/public IP. |
| Empty peer list | Others not connected; wait ~10–30s; open browser devtools → Console for `[p2p]` / `[gossip]` logs. |
| `NO_RESERVATION` in logs | Often harmless on one machine with many tabs; separate laptops usually fine. |

---

## Quick checklist

- [ ] Bootstrap: `cd p2p && npm install && npm run bootstrap` (stay running)
- [ ] Note bootstrap IP; firewall allows **4012**
- [ ] Every laptop: `frontend/.env.local` with `VITE_BOOTSTRAP_ADDR=/ip4/<that-ip>/tcp/4012/ws`
- [ ] Every laptop: `cd frontend && npm run dev` → open **http://localhost:5173**
