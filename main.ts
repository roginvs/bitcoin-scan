import { genesisBlockHash } from "./bitcoin/consts";
import { sha256 } from "./bitcoin/hashes";
import { createGetheadersMessage } from "./bitcoin/messages.create";
import { readBlockHeader, readVarInt } from "./bitcoin/messages.parse";
import { BlockHash, MessagePayload } from "./bitcoin/messages.types";
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

/**
 * We ask for blocks using "getheaders" message
 * And then we parse result in onHeaders
 */
function getHeadersToFetchBlockchain() {
  const fewLastKnownBlocks = blockchain
    .getLastKnownBlocks()
    .map((block) => block.hash);
  peer.send(createGetheadersMessage(fewLastKnownBlocks));
}

function reverseBuf(buf: Buffer) {
  const reversed = Buffer.alloc(buf.length);
  buf.copy(reversed);
  reversed.reverse();
  return reversed;
}

/**
 * Check block hashes, save them into database, call fetchBlockChain again
 * We do not support resolving blockchain branching.
 *   If this happened just remove last blocks from the database
 */
function onHeadersMessage(payload: MessagePayload) {
  let lastKnownBlock = blockchain.getLastKnownBlocks().slice().shift()!.hash;

  let [count, headers] = readVarInt(payload);
  if (count > 0) {
    while (count > 0) {
      const [block, rest, hashingData] = readBlockHeader(headers);
      headers = rest;

      if (lastKnownBlock && lastKnownBlock.equals(block.prevBlock)) {
        const blockHash = sha256(sha256(hashingData)) as BlockHash;
        lastKnownBlock = blockHash;
        blockchain.pushNewKnownBlock(blockHash);
        const lastKnownBlockFromDb = blockchain
          .getLastKnownBlocks()
          .slice()
          .shift()!;
        if (!lastKnownBlockFromDb.hash.equals(blockHash)) {
          throw new Error(
            `Internal error: database must have last block the one we pushed!`
          );
        }

        console.info(
          `Got new block ${reverseBuf(lastKnownBlock).toString(
            "hex"
          )} current height = ${lastKnownBlockFromDb.id} `
        );
      } else {
        console.warn(
          `Hmm, got block but not understand where it is. Maybe good to save it`
        );
      }

      count--;
    }
    getHeadersToFetchBlockchain();
  } else {
    // Just break the loop
    console.info(
      `Got no block headers, breaking the blockheaders fetching loop. Starting to fetch blocks`
    );
    // TODO: Fetch blocks
  }
}
peer.onMessage = (command, payload) => {
  if (command === "headers") {
    onHeadersMessage(payload);
  } else {
    console.info("msg:", command, payload);
  }
};

getHeadersToFetchBlockchain();
