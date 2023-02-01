import { createGetdataMessage } from "./bitcoin.protocol/messages.create";
import { readBlock, readInvPayload } from "./bitcoin.protocol/messages.parse";
import {
  BlockPayload,
  HashType,
  InventoryItem,
} from "./bitcoin.protocol/messages.types";
import { createPeer } from "./bitcoin.protocol/peer.outgoing";

/*

Some experiments with protocol

*/

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
  } else if (command === "block") {
    console.info(`Got block:`);
    const block = readBlock(payload as Buffer as BlockPayload);
    console.info(block);
  } else {
    console.info(command);
  }
};

peer.send(
  createGetdataMessage([
    [
      HashType.MSG_WITNESS_BLOCK,
      Buffer.from(
        "00000000000000000005f883a624ff0896bdfaa2020630b5e98d400fba5d0972",
        "hex"
      ).reverse(),
    ],
  ] as any[])
);
