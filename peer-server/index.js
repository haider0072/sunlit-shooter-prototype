import { PeerServer } from "peer";

const port = Number(process.env.PORT ?? 9000);
const path = process.env.PEER_PATH ?? "/peerjs";

const server = PeerServer({
  port,
  path,
  allow_discovery: true,
  proxied: true,
  corsOptions: {
    origin: "*"
  }
});

server.on("connection", (client) => {
  console.log(`peer connected: ${client.getId()}`);
});

server.on("disconnect", (client) => {
  console.log(`peer disconnected: ${client.getId()}`);
});

console.log(`PeerServer listening on :${port}${path}`);
