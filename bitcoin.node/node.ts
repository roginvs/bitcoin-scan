import { genesisBlockHash } from "../bitcoin.protocol/consts";
import {
  createGetdataMessage,
  createGetheadersMessage,
} from "../bitcoin.protocol/messages.create";
import {
  BitcoinBlock,
  readBlock,
  readVarInt,
} from "../bitcoin.protocol/messages.parse";
import {
  BlockHash,
  BlockPayload,
  HashType,
  MessagePayload,
  TransactionHash,
} from "../bitcoin.protocol/messages.types";
import { createPeer } from "../bitcoin.protocol/peer.outgoing";
import { createNodeStorage } from "./node.storage";

export type PeerAddr = [string, number];
export function createBitcoinNode(
  bootstrapPeers: PeerAddr[],
  saveOnlyLastNBlocks?: number,
  /**
   * This is called when new block is fetched.
   * Starting from the bottom of the blockchain.
   * When callback returns then state is saved into database
   *
   */
  onNewValidatedBlock?: (block: BitcoinBlock) => void
) {
  const storage = createNodeStorage();

  let currentPeerIndex = 0;
  function createPeerFromList() {
    const lastKnownBlock = storage.getLastKnownBlockId() || 0;
    const peerCreated = createPeer(
      bootstrapPeers[currentPeerIndex][0],
      bootstrapPeers[currentPeerIndex][1],
      lastKnownBlock
    );
    peerCreated.onMessage = onMessage;
    return peerCreated;
  }

  let peer = createPeerFromList();

  function onMessage(command: string, payload: MessagePayload) {
    if (command === "") {
      // disconnected
      // TODO: drop all waiters
      peer = createPeerFromList();
    } else if (command === "headers") {
      onHeadersMessage(payload);
    } else if (command === "block") {
      onBlockMessage(payload as Buffer as BlockPayload);
    } else {
      console.info("msg:", command, payload);
    }
  }

  const blocksWeWantToFetch: BlockHash[] = [];

  function onBlockMessage(payload: BlockPayload) {
    const [block, rest] = readBlock(payload);
    if (rest.length !== 0) {
      console.error(
        `Got some data after block message ${rest.toString("hex")}`
      );
      peer.close();
    }

    // TODO: Ensure that we receiving blocks in correct order
    // TODO: Throw if we receive "notfound"
    const index = blocksWeWantToFetch.findIndex((x) =>
      x.hash.equals(block.hash)
    );
    if (index < 0) {
      console.warn(`Got unexpected block ${block.hash}`);
      return;
    }
    const blockData = blocksWeWantToFetch[index];
    blocksWeWantToFetch.splice(index, 1);

    processBlock(block, blockData.id);

    if (blocksWeWantToFetch.length === 0) {
      if (!USE_DEMO_BLOCKS) {
        fetchPackOfUnprocessedBlocks();
      } else {
        console.info(`Not fetching next blocks due to demo mode`);
      }
    }
  }

  function onHeadersMessage(payload: MessagePayload) {
    let lastKnownBlock = storage.getLastKnownBlocksHashes().slice().shift();

    if (blocksWeWantToFetch.length > 0) {
      console.error(`Got unexpected headers`);
      return;
    }

    let [count, headers] = readVarInt(payload);
    if (count > 0) {
      while (count > 0) {
        const [block, rest] = readBlock(headers as BlockPayload);
        headers = rest;

        if (
          lastKnownBlock
            ? lastKnownBlock.equals(block.prevBlock)
            : block.hash.equals(genesisBlockHash)
        ) {
          // It might be good to check difficulty for this block
          lastKnownBlock = block.hash;
          blocksWeWantToFetch.push(block.hash);

          console.info(
            `Got new block ${Buffer.from(block.hash)
              .reverse()
              .toString("hex")} time=${block.timestamp.toISOString()}`
          );
        } else {
          console.warn(
            `Hmm, got block ${Buffer.from(block.hash)
              .reverse()
              .toString(
                "hex"
              )} time=${block.timestamp.toISOString()} but not understand where it is. Maybe good to save it`
          );
        }

        count--;
      }

      // Fetch blocks data
      peer.send(
        createGetdataMessage(
          blocksWeWantToFetch.map((blockHash) => [
            HashType.MSG_BLOCK,
            blockHash,
          ])
        )
      );
    } else {
      // This peer do not know more blocks, let's wait for "inv" packet
    }
  }

  // We start from this one
  function getHeadersToFetchBlockchain() {
    const fewLastKnownBlocks = storage.getLastKnownBlocksHashes();
    if (fewLastKnownBlocks.length === 0) {
      fewLastKnownBlocks.push(genesisBlockHash);
    }

    peer.send(createGetheadersMessage(fewLastKnownBlocks));
  }

  getHeadersToFetchBlockchain();

  return {
    getSavedBlocks(cursorName: string, onBlock: (block: BitcoinBlock) => void) {
      // Maybe return only when all saved blocks are pushed
    },
    destroy() {
      throw new Error(`Not implemented`);
    },
    getTransaction(txId: TransactionHash) {
      // Via table with "txId","blockN","blockOffset"
      throw new Error(`Not implemented`);
    },
    getBlock(blockHash: BlockHash) {
      // If we implement this then we need index on the block hash
      throw new Error(`Not implemented`);
    },
  };
}
