//import { genesisBlockHash } from "../bitcoin.protocol/consts";
const genesisBlockHash = Buffer.from(
  "00000000000000000005f883a624ff0896bdfaa2020630b5e98d400fba5d0972",
  "hex"
).reverse() as BlockHash;

import {
  createGetdataMessage,
  createGetheadersMessage,
  packVarInt,
} from "../bitcoin.protocol/messages.create";
import {
  BitcoinBlock,
  readAddrWithTime,
  readBlock,
  readInvPayload,
  readNotFoundPayload,
  readTx,
  readVarInt,
} from "../bitcoin.protocol/messages.parse";
import {
  BlockHash,
  BlockPayload,
  HashType,
  MessagePayload,
  TransactionHash,
} from "../bitcoin.protocol/messages.types";
import { createPeer, PeerConnection } from "../bitcoin.protocol/peer.outgoing";
import { joinBuffers } from "../bitcoin.protocol/utils";
import { BitcoinNodeApi, BitcoinNodePlugin } from "./node.plugin";
import { createNodeStorage } from "./node.storage";

export type PeerAddr = [string, number];

function dumpBuf(buf: Buffer) {
  const str = Buffer.from(buf).reverse().toString("hex");
  return str.slice(0, 8) + "-" + str.slice(-8);
}
export function createBitcoinNode(
  bootstrapPeers: PeerAddr[],
  plugins: BitcoinNodePlugin[] = []
) {
  const storage = createNodeStorage();

  /*

Algoritm:
  - On startup fetch genenis block if blockchain is empty
  - Fetch headers chain from the first peer
    - When it is done start to download blocks data
  - On each new peer fetch headers chain
    - But only one peer at time


  - TODO:
    - If "inv" with blocks were received during request for headers
      then re-request headers when all headers are done
  
  
*/

  const MAX_PEERS = 10;
  const MAX_DOWNLOADING_PEERS = 5;
  const MAX_BUFFERED_BLOCKS = 15;

  const peers: PeerConnection[] = [];

  /**
   * This is a queue of peers to fetch headers chain.
   * We fetching chain only from one peer at time so first item in this array
   * is peer from which we are fetching
   */
  const peersToFetchHeaders: PeerConnection[] = [];

  /** We can fetch blocks when we have updated blockchain from at least one peer */
  let canFetchBlocks = false;

  const peersBlocksTasks = new Map<PeerConnection, BlockHash>();
  const blocksDownloadingNowStartedAt = new Map<string, Date>(); // We can not compare buffers directly!
  const bufferedBlocks = new Map<string, BitcoinBlock>();

  function connectToPeer(addr: PeerAddr) {
    const currentLastKnownBlockId = storage.getLastKnownBlockId();
    console.info(
      `Creating new peer ${addr[0]}:${addr[1]}, ` + `count=${peers.length + 1}`
    );
    const peer = createPeer(
      addr[0],
      addr[1],
      currentLastKnownBlockId ? currentLastKnownBlockId - 1 : 0
    );
    peer.onMessage = (cmd, payload) => onMessage(peer, cmd, payload);
    peers.push(peer);

    peersToFetchHeaders.push(peer);
    if (peersToFetchHeaders.length === 1) {
      performInitialHeadersDownload(peer);
    }
    if (canFetchBlocks) {
      givePeersTasksToDownloadBlocks();
    }
  }

  function performInitialHeadersDownload(peer: PeerConnection) {
    const fewLastKnownBlocks = storage.getLastKnownBlocksHashes();
    if (fewLastKnownBlocks.length > 0) {
      peer.send(createGetheadersMessage(fewLastKnownBlocks));
      peer.raiseWatchdog("headers");
    } else {
      // A initial case when no data even for genesis block
      peer.raiseWatchdog("genesis block data");
      peer.send(
        createGetdataMessage([[HashType.MSG_WITNESS_BLOCK, genesisBlockHash]])
      );
    }
  }

  function onPeerDisconnected(peer: PeerConnection) {
    const idx = peers.indexOf(peer);
    if (idx < 0) {
      throw new Error(`Internal error`);
    }
    peers.splice(idx, 1);
    console.info(`${peer.id} disconnected, now have ${peers.length} peers`);

    if (peersToFetchHeaders[0] === peer) {
      // This peer was in the downloading phase
      peersToFetchHeaders.splice(0, 1);
      if (peersToFetchHeaders.length > 0) {
        // Switch to another peer
        performInitialHeadersDownload(peersToFetchHeaders[0]);
      } else {
        if (canFetchBlocks) {
          // Do nothing, we will get new peers from headers later
        } else {
          // It means we do not have any peers more. We will not get any new peers
          // So the best is to terminate
          throw new Error(`No candidates for initial blockheaders download`);
        }
      }
    } else {
      // Remove peer from waiting queue if it was there
      const idx = peersToFetchHeaders.indexOf(peer);
      if (idx > -1) {
        peersToFetchHeaders.splice(idx, 1);
      }
    }

    const peerDownloadingBlock = peersBlocksTasks.get(peer);
    if (peerDownloadingBlock) {
      blocksDownloadingNowStartedAt.delete(
        peerDownloadingBlock.toString("hex")
      );
      peersBlocksTasks.delete(peer);
      givePeersTasksToDownloadBlocks();
    }

    if (peers.length === 0) {
      console.info(`We are out of peers, starting from the beginning`);
      connectToBootstapPeers();
    }
  }

  function onMessage(
    peer: PeerConnection,
    cmd: string,
    payload: MessagePayload
  ) {
    if (cmd === "") {
      onPeerDisconnected(peer);
    } else if (cmd === "headers") {
      onHeadersMessage(peer, payload);
    } else if (cmd === "addr") {
      onAddrMessage(peer, payload);
    } else if (cmd === "block") {
      onBlockMessage(peer, payload as Buffer as BlockPayload);
    } else if (cmd === "notfound") {
      onNotFoundMessage(peer, payload);
    } else if (cmd === "inv") {
      // Just ignore for now
      // TODO: If is a block and we have chain then re-download it?
    } else if (cmd === "getheaders") {
      // TODO
    } else {
      console.info(`${peer.id} unknown message ${cmd}`);
    }
  }

  function onHeadersMessage(peer: PeerConnection, payload: MessagePayload) {
    if (peersToFetchHeaders[0] !== peer) {
      console.warn(`${peer.id} Got headers from the wrong peer`);
      return;
    }

    peer.clearWatchdog("headers");

    let lastKnownBlock = storage.getLastKnownBlocksHashes().slice().shift()!;

    let [count, headers] = readVarInt(payload);
    console.info(`${peer.id} Got headers for ${count} blocks`);
    if (count > 0) {
      while (count > 0) {
        const [block, rest] = readBlock(headers as BlockPayload);
        const headersRaw = headers.subarray(
          0,
          headers.length - rest.length
        ) as BlockPayload;
        headers = rest;

        // TODO: if block is in our blockchain then just skip
        // But if is is not then his prevBlock should be
        // If so then we should detect branching

        if (lastKnownBlock && lastKnownBlock.equals(block.prevBlock)) {
          // TODO:check difficulty for this block
          lastKnownBlock = block.hash;
          storage.pushNewBlockHeader(block.hash, block.headerPayload);

          // Health-check
          const lastKnownBlockHashFromDb = storage
            .getLastKnownBlocksHashes()
            .slice()
            .shift()!;
          if (!lastKnownBlockHashFromDb.equals(block.hash)) {
            throw new Error(
              `Internal error: database must have last block the one we pushed!`
            );
          }

          // const lastKnownBlockIdInDb = storage.getLastKnownBlockId()!;
          // console.info(
          //   `${peer.id} Got new block ${dumpBuf(
          //     lastKnownBlock
          //   )} time=${block.timestamp.toISOString()} current height = ${
          //     lastKnownBlockIdInDb - 1
          //   } `
          // );
        } else {
          console.warn(
            `${peer.id} Hmm, got block ${dumpBuf(
              lastKnownBlock
            )} time=${block.timestamp.toISOString()} but not understand where it is. Maybe good to save it`
          );
        }

        count--;
      }
      performInitialHeadersDownload(peer);
    } else {
      // Ok, this peer have no idea about more blocks
      peersToFetchHeaders.splice(0, 1);

      if (peersToFetchHeaders.length > 0) {
        const nextPeerToFetchBlockheadersChain = peersToFetchHeaders[0];
        console.info(
          `${peer.id} No more headers from this peer, picking new one ${nextPeerToFetchBlockheadersChain.id}`
        );
        performInitialHeadersDownload(nextPeerToFetchBlockheadersChain);
      } else {
        console.info(
          `${peer.id} No more headers from this peer, no more peers in queue`
        );
      }

      if (!canFetchBlocks) {
        canFetchBlocks = true;
        givePeersTasksToDownloadBlocks();
      }
    }
    console.info(
      `${peer.id} Current height = ${(storage.getLastKnownBlockId() || 0) - 1}`
    );
  }

  function onAddrMessage(peer: PeerConnection, payload: MessagePayload) {
    let addrCount;
    let buf: Buffer = payload;
    [addrCount, buf] = readVarInt(buf);
    while (addrCount > 0) {
      const [addr, rest] = readAddrWithTime(buf);
      buf = rest;

      const isPeerAlreadyConnected = peers.some(
        (p) => p.host === addr.host && p.port === addr.port
      );
      if (!isPeerAlreadyConnected) {
        if (addr.ipFamily === 4) {
          if (peers.length > MAX_PEERS) {
            console.info(
              `${peer.id} Got ipv4 addr but we have enough peers so ignoring ${addr.host}:${addr.port}`
            );
          } else {
            console.info(
              `${peer.id} Got ipv4 addr, adding to the list ${addr.host}:${addr.port}`
            );
            connectToPeer([addr.host, addr.port]);
          }
        } else {
          console.info(
            `${peer.id} Got ipv6 addr, ignoring ${addr.host}:${addr.port}`
          );
        }
      } else {
        console.info(
          `${peer.id} Got addr which is already connected ${addr.host}:${addr.port}`
        );
      }

      addrCount--;
    }
  }

  function onBlockMessage(peer: PeerConnection, payload: BlockPayload) {
    const [block, rest] = readBlock(payload);
    if (rest.length !== 0) {
      console.warn(
        `${peer.id} Got some data after block message ${rest.toString("hex")}`
      );
      peer.close();
      return;
    }

    if (!canFetchBlocks) {
      // Special case: fetching genesis header
      if (!block.hash.equals(genesisBlockHash)) {
        console.warn(
          `${
            peer.id
          } Got unknown block hash during initial chain download ${dumpBuf(
            block.hash
          )}`
        );
        peer.close();
        return;
      }

      storage.pushNewBlockHeader(block.hash, block.headerPayload);
      peer.clearWatchdog("genesis block data");
      performInitialHeadersDownload(peer);
      return;
    }

    const expectingBlockHash = peersBlocksTasks.get(peer);
    if (!expectingBlockHash || !expectingBlockHash.equals(block.hash)) {
      console.warn(`${peer.id} unknown block ${dumpBuf(block.hash)}`);
      peer.close();
      return;
    }

    peersBlocksTasks.delete(peer);
    const downloadStartedAt = blocksDownloadingNowStartedAt.get(
      expectingBlockHash.toString("hex")
    )!;
    const durationSeconds =
      (new Date().getTime() - downloadStartedAt.getTime()) / 1000;
    const speedMbs = (
      (payload.length * 8) /
      1000 /
      1000 /
      durationSeconds
    ).toFixed(2);
    blocksDownloadingNowStartedAt.delete(expectingBlockHash.toString("hex"));
    peer.clearWatchdog("get-block-" + expectingBlockHash.toString("hex"));

    const storageExpectingBlock = storage
      .getBlockIdsWithoutTransactions(1)
      .shift()?.hash;
    if (!storageExpectingBlock) {
      throw new Error(
        `Storage error: why this block ${dumpBuf(
          block.hash
        )} was fetched if nothing expected there?`
      );
    }

    if (storageExpectingBlock.equals(block.hash)) {
      console.info(
        `Block download: ${peer.id} downloaded ${dumpBuf(
          block.hash
        )} in ${durationSeconds}s ${speedMbs}mb/s, block is going to database`
      );

      // TODO: Validate block
      plugins.forEach((plugin) => plugin.onNewValidatedBlock?.(block));
      storage.saveBlockTransactions(block.hash, block.transactions);

      // Now flushing buffer
      while (true) {
        const nextExpectingBlock = storage
          .getBlockIdsWithoutTransactions(1)
          .shift()?.hash;
        if (!nextExpectingBlock) {
          break;
        }
        const blockInBuffer = bufferedBlocks.get(
          nextExpectingBlock.toString("hex")
        );
        if (!blockInBuffer) {
          break;
        }

        console.info(
          `Block download: ${dumpBuf(
            nextExpectingBlock
          )} is in buffer so using it`
        );

        // TODO: Validate block
        plugins.forEach((plugin) =>
          plugin.onNewValidatedBlock?.(blockInBuffer)
        );
        storage.saveBlockTransactions(
          blockInBuffer.hash,
          blockInBuffer.transactions
        );
        bufferedBlocks.delete(nextExpectingBlock.toString("hex"));
      }
    } else {
      console.info(
        `Block download: ${peer.id} downloaded ${dumpBuf(
          block.hash
        )} in ${durationSeconds}s ${speedMbs}mb/s, keeping data in buffer`
      );
      bufferedBlocks.set(block.hash.toString("hex"), block);
    }
    givePeersTasksToDownloadBlocks();
  }

  function onNotFoundMessage(peer: PeerConnection, payload: MessagePayload) {
    for (const item of readNotFoundPayload(payload)) {
      if (item[0] === HashType.MSG_WITNESS_BLOCK) {
        const blockHash = item[1];
        const expectingBlockHash = peersBlocksTasks.get(peer);
        if (!expectingBlockHash || !expectingBlockHash.equals(blockHash)) {
          console.warn(
            `${peer.id} unknown notfound for block ${dumpBuf(item[1])}`
          );
          peer.close();
        } else {
          console.info(`Block download: ${peer.id} do not have ${blockHash}`);
          // Sad that this peer do not have this block. Let's hope others will have it
          peersBlocksTasks.delete(peer);
          blocksDownloadingNowStartedAt.delete(
            expectingBlockHash.toString("hex")
          );
          givePeersTasksToDownloadBlocks();
        }
      } else {
        console.warn(
          `${peer.id} unknown notfound ${item[0]} ${dumpBuf(item[1])}`
        );
        peer.close();
      }
    }
  }

  function givePeersTasksToDownloadBlocks() {
    if (!canFetchBlocks) {
      throw new Error(`Internal error: this should never be called`);
    }
    if (bufferedBlocks.size >= MAX_BUFFERED_BLOCKS) {
      console.info(`Block download: buffer is full!`);
      // We already have a lot data which is unprocessed yet
      return;
    }
    const blocksToDownload = storage
      .getBlockIdsWithoutTransactions(MAX_BUFFERED_BLOCKS)
      .filter((blockInfo) => {
        const notDownloadingNow = !blocksDownloadingNowStartedAt.has(
          blockInfo.hash.toString("hex")
        );
        const notInBuffer = !bufferedBlocks.has(blockInfo.hash.toString("hex"));
        return notDownloadingNow && notInBuffer;
      });

    const thresholdOfBuffer = MAX_BUFFERED_BLOCKS - bufferedBlocks.size;
    const freePeers = peers.filter((p) => !peersBlocksTasks.has(p));
    const availablePeersForDownloading = freePeers
      .slice()
      .sort(() => Math.random() * 2 - 1)
      .slice(
        0,

        Math.min(
          thresholdOfBuffer,
          MAX_DOWNLOADING_PEERS,
          blocksToDownload.length
        )
      );
    console.info(
      `Block download: max=${MAX_DOWNLOADING_PEERS} ` +
        `bufAvailable=${thresholdOfBuffer} freePeers=${freePeers.length} ` +
        `blockToDownload=${blocksToDownload.length} ` +
        `startJobs=${availablePeersForDownloading.length}`
    );
    for (const [i, peer] of availablePeersForDownloading.entries()) {
      const blockInfo = blocksToDownload[i];
      if (!blockInfo) {
        throw new Error(`Internal error`);
      }
      console.info(
        `  - ${peer.id} will download ${dumpBuf(blockInfo.hash)} h=${
          blockInfo.id - 1
        }`
      );

      peersBlocksTasks.set(peer, blockInfo.hash);
      blocksDownloadingNowStartedAt.set(
        blockInfo.hash.toString("hex"),
        new Date()
      );
      peer.send(
        createGetdataMessage([[HashType.MSG_WITNESS_BLOCK, blockInfo.hash]])
      );
      peer.raiseWatchdog(
        "get-block-" + blockInfo.hash.toString("hex"),
        10 * 60 * 1000
      );
    }
  }

  function connectToBootstapPeers() {
    for (const addr of bootstrapPeers) {
      connectToPeer(addr);
    }
  }

  connectToBootstapPeers();

  function getBlock(blockHash: BlockHash): BitcoinBlock {
    const header = storage.getBlockHeader(blockHash);

    const transactionsPayload = storage.getBlockTransactions(blockHash);

    const [block, rest] = readBlock(
      joinBuffers(
        header,
        packVarInt(transactionsPayload.length),
        ...transactionsPayload
      ) as BlockPayload
    );
    if (rest.length !== 0) {
      throw new Error(`Db error`);
    }
    return block;
  }

  const me: BitcoinNodeApi = {
    destroy() {
      throw new Error(`Not implemented`);
    },
    getBlock,
  };
  plugins.forEach((plugin) => plugin.onCreate?.(me));
  return me;
}
