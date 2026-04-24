# Sunlit Patrol — Private PeerJS Server

A tiny WebSocket signaling server so multiplayer does not depend on the flaky public `0.peerjs.com`.

## Deploy to Railway (recommended, 5 min, free)

1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Pick this repo, set root directory to `peer-server/`
3. Railway auto-detects `npm start`
4. Once deployed, open the service → Settings → Networking → **Generate Domain**
5. Copy the URL, e.g. `sunlit-peer-server.up.railway.app`

## Deploy to Render (alternative, 5 min, free)

1. https://render.com → New → Web Service
2. Connect this repo, set root to `peer-server/`, runtime Node
3. Build: `npm install` · Start: `npm start`
4. After deploy, copy the URL, e.g. `sunlit-peer-server.onrender.com`

## Point the game at your server

Add `?peer=your-host.up.railway.app` to the game URL, e.g.

```
https://your-game.vercel.app/?peer=sunlit-peer-server.up.railway.app
```

That's it — the client will use your server for signaling.

## Local dev

```bash
cd peer-server
npm install
npm start
```

Server listens on `http://localhost:9000/peerjs`.

Point the game at it with `?peer=localhost:9000&peerPath=/peerjs&peerSecure=0`.
