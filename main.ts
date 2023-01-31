import { readInvPayload } from "./bitcoin.protocol/messages.parse";
import { HashType } from "./bitcoin.protocol/messages.types";
import { createPeer } from "./bitcoin.protocol/peer.outgoing";

const peerAddr = process.argv[2] || "95.216.21.47";
const peerPort = process.argv[3] ? parseInt(process.argv[3]) : 8333;
console.info(`Will use ${peerAddr}:${peerPort} to fetch data`);
const peer = createPeer(peerAddr, peerPort, 3);

peer.onMessage = (command, payload) => {
  if (command === "inv") {
    const data = readInvPayload(payload);
    console.info(`Received inv with ${data.length} items total`);
    for (const [type, hash] of data) {
      if (type === HashType.MSG_BLOCK) {
        console.info(`  block ${Buffer.from(hash).reverse().toString("hex")}`);
      }
    }
  }
};
