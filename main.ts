import { genesisBlockHash } from "./bitcoin/consts";
import { createGetheadersMessage } from "./bitcoin/messages.create";
import { createPeer } from "./bitcoin/peer";
import { BlockDB, createBlockchainStorage } from "./db/blockchain";

const blockchain = createBlockchainStorage();

const lastKnownBlockAtStartup = blockchain.getLastKnownBlocks(1)[0].id - 1;
const peer = createPeer("95.216.21.47", 8333, lastKnownBlockAtStartup);

/*
const blocksWeAreWaiting: BlockDB[] = [];
function fetchUnprocessedBlocks() {
  if (blocksWeAreWaiting.length > 0){
    return;
  }
  const nextBlocksToFetch = 
  //const lastKnownBlocks;
}
*/

function fetchBlockchain() {
  const fewLastKnownBlocks = blockchain
    .getLastKnownBlocks()
    .map((block) => block.hash);
  peer.send(createGetheadersMessage(fewLastKnownBlocks));
}

peer.onMessage = (command, payload) => {
  console.info("msg:", command, payload);
};

fetchBlockchain();
