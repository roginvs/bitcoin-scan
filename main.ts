import { genesisBlockHash } from "./bitcoin/consts";
import { sha256 } from "./bitcoin/hashes";
import {
  createGetdataMessage,
  createGetheadersMessage,
} from "./bitcoin/messages.create";
import { BitcoinBlock, readBlock, readVarInt } from "./bitcoin/messages.parse";
import {
  BlockHash,
  BlockPayload,
  HashType,
  MessagePayload,
} from "./bitcoin/messages.types";
import { createPeer } from "./bitcoin/peer";
import { BlockDB, BlockId, createBlockchainStorage } from "./db/blockchain";

const blockchain = createBlockchainStorage();

const lastKnownBlockAtStartup = blockchain.getLastKnownBlocks(1)[0].id - 1;
const peer = createPeer("95.216.21.47", 8333, lastKnownBlockAtStartup);

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
      const [block, rest] = readBlock(headers as BlockPayload);
      headers = rest;

      if (lastKnownBlock && lastKnownBlock.equals(block.prevBlock)) {
        // It might be good to check difficulty for this block
        lastKnownBlock = block.hash;
        blockchain.pushNewKnownBlock(block.hash);
        const lastKnownBlockFromDb = blockchain
          .getLastKnownBlocks()
          .slice()
          .shift()!;
        if (!lastKnownBlockFromDb.hash.equals(block.hash)) {
          throw new Error(
            `Internal error: database must have last block the one we pushed!`
          );
        }

        console.info(
          `Got new block ${reverseBuf(lastKnownBlock).toString(
            "hex"
          )} time=${block.timestamp.toISOString()} current height = ${
            lastKnownBlockFromDb.id - 1
          } `
        );
      } else {
        console.warn(
          `Hmm, got block ${reverseBuf(lastKnownBlock).toString(
            "hex"
          )} time=${block.timestamp.toISOString()} but not understand where it is. Maybe good to save it`
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

    fetchPackOfUnprocessedBlocks();
  }
}

const blocksWeAreWaiting: BlockDB[] = [];

const USE_DEMO_BLOCKS = true;
function fetchPackOfUnprocessedBlocks() {
  if (blocksWeAreWaiting.length > 0) {
    console.warn(`LOL Who called this func?`);
    return;
  }

  const demoBlocks: BlockDB[] = [
    {
      hash: Buffer.from(
        "0000000000000000000052275994b49b434f3fc698008ee4a2920e9aebbcba25",
        "hex"
      ).reverse() as BlockHash,
      id: 0 as BlockId,
    },
    {
      hash: Buffer.from(
        "0000000000000000000456bb21edbb8427586335158c08498daa3236b040c8d8",
        "hex"
      ).reverse() as BlockHash,
      id: 0 as BlockId,
    },
  ];

  const nextBlocksToFetch = USE_DEMO_BLOCKS
    ? demoBlocks
    : blockchain.getNextUprocessedBlocks();
  if (nextBlocksToFetch.length === 0) {
    console.info("No more blocks to process!");
  }
  blocksWeAreWaiting.push(...nextBlocksToFetch);
  peer.send(
    createGetdataMessage(
      blocksWeAreWaiting.map((blockHash) => [
        HashType.MSG_BLOCK,
        blockHash.hash,
      ])
    )
  );
}

function onBlockMessage(payload: BlockPayload) {
  const [block, rest] = readBlock(payload);
  if (rest.length !== 0) {
    throw new Error(
      `Got some data after block message ${rest.toString("hex")}`
    );
  }
  const index = blocksWeAreWaiting.findIndex((x) => x.hash.equals(block.hash));
  if (index < 0) {
    console.warn(`Got unexpected block ${block.hash}`);
    return;
  }
  blocksWeAreWaiting.splice(index, 1);

  processBlock(block);

  if (blocksWeAreWaiting.length === 0) {
    if (!USE_DEMO_BLOCKS) {
      fetchPackOfUnprocessedBlocks();
    } else {
      console.info(`Not fetching next blocks due to demo mode`);
    }
  }
}

function processBlock(block: BitcoinBlock) {
  console.info(`Processing block ${reverseBuf(block.hash).toString("hex")}`);
  // TODO
}

peer.onMessage = (command, payload) => {
  if (command === "headers") {
    onHeadersMessage(payload);
  } else if (command === "block") {
    onBlockMessage(payload as Buffer as BlockPayload);
  } else {
    console.info("msg:", command, payload);
  }
};

getHeadersToFetchBlockchain();
