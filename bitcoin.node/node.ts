import { genesisBlockHash } from "../bitcoin.protocol/consts";
//const genesisBlockHash = Buffer.from(
//  "00000000000000000005f883a624ff0896bdfaa2020630b5e98d400fba5d0972",
//  "hex"
//).reverse() as BlockHash;
//

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
import {
  BitcoinNodeApi,
  NewBlockListener,
  SubscribeEvent,
} from "./node.plugin";
import { BlockId, createNodeStorage } from "./node.storage";
import { createLogger } from "../logger/logger";

const { info, debug, warn } = createLogger("NODE");

export type PeerAddr = readonly [string, number];

function dumpBuf(buf: Buffer) {
  const str = Buffer.from(buf).reverse().toString("hex");
  return str.slice(0, 8) + "-" + str.slice(-8);
}
function getBootstrapPeers() {
  const peersString = process.env.NODE_BOOTSTRAP_PEERS;
  if (!peersString) {
    throw new Error(`No NODE_BOOTSTRAP_PEERS in env`);
  }
  const peers = peersString
    .split(",")
    .map((pStr) => pStr.trim())
    .map((pStr) => {
      const [host, portStr] = pStr.split(":").map((s) => s.trim());
      if (!host) {
        throw new Error(`Wrong peers string`);
      }
      const port = portStr ? Number(portStr) : 8333;
      return [host, port] as const;
    });
  return peers;
}

export function createBitcoinNode() {
  const bootstrapPeers = getBootstrapPeers();

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

  const newBlockListeners: NewBlockListener[] = [];

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
  let currentlyFetchingHeadersPeerSentInvWithSomeBlock = false;

  /** We can fetch blocks when we have updated blockchain from at least one peer */
  let canFetchBlocks = false;

  const peersBlocksTasks = new Map<PeerConnection, BlockHash>();
  const blocksDownloadingNowStartedAt = new Map<string, Date>(); // We can not compare buffers directly!
  const bufferedBlocks = new Map<
    string,
    [block: BitcoinBlock, downloadInfo: string, peerId: string]
  >();

  function connectToPeer(addr: PeerAddr) {
    const currentLastKnownBlockId = storage.getLastKnownBlockId();
    info(
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
      // This flag should be already dropped, just in case
      currentlyFetchingHeadersPeerSentInvWithSomeBlock = false;
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
    info(`${peer.id} disconnected, now have ${peers.length} peers`);

    if (peersToFetchHeaders[0] === peer) {
      // This peer was in the downloading phase
      peersToFetchHeaders.splice(0, 1);
      currentlyFetchingHeadersPeerSentInvWithSomeBlock = false;
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
      info(`We are out of peers, starting from the beginning`);
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
      onInvMessage(peer, payload);
    } else if (cmd === "getheaders") {
      // TODO
    } else {
      debug(`${peer.id} unknown message ${cmd}`);
    }
  }

  function onInvMessage(peer: PeerConnection, payload: MessagePayload) {
    const data = readInvPayload(payload);
    const isHaveBlockInv = data.some(
      (inv) =>
        inv[0] === HashType.MSG_BLOCK || inv[0] === HashType.MSG_WITNESS_BLOCK
    );
    if (isHaveBlockInv) {
      if (peersToFetchHeaders[0] === peer) {
        // If we are fetching headers now then raise flag that inv was received
        //  and we need to ask for headers even when we done
        if (!currentlyFetchingHeadersPeerSentInvWithSomeBlock) {
          debug(
            `${peer.id} got blocks inv, will re-fetch headers when done with current`
          );
          currentlyFetchingHeadersPeerSentInvWithSomeBlock = true;
        }
      } else {
        if (!peersToFetchHeaders.includes(peer)) {
          // If no then add this peer into fetching headers queue
          peersToFetchHeaders.push(peer);

          if (peersToFetchHeaders.length === 1) {
            debug(`${peer.id} got blocks inv, let's see what it have`);
            // This flag should be already dropped, just in case
            currentlyFetchingHeadersPeerSentInvWithSomeBlock = false;
            performInitialHeadersDownload(peer);
          } else {
            debug(
              `${peer.id} got blocks inv, added to queue of headers fetching`
            );
          }
        }
      }
    }
  }

  function onHeadersMessage(peer: PeerConnection, payload: MessagePayload) {
    if (peersToFetchHeaders[0] !== peer) {
      warn(`${peer.id} Got headers from the wrong peer`);
      return;
    }

    peer.clearWatchdog("headers");

    let lastKnownBlock = storage.getLastKnownBlocksHashes().slice().shift()!;

    const startedWithLastKnownId = storage.getLastKnownBlockId();

    const [headersCount, headersAll] = readVarInt(payload);
    let headersBuf = headersAll;
    debug(`${peer.id} Got headers for ${headersCount} blocks`);
    if (headersCount > 0) {
      for (let i = 0; i < headersCount; i++) {
        const [block, rest] = readBlock(headersBuf as BlockPayload);
        headersBuf = rest;

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
          // info(
          //   `${peer.id} Got new block ${dumpBuf(
          //     lastKnownBlock
          //   )} time=${block.timestamp.toISOString()} current height = ${
          //     lastKnownBlockIdInDb - 1
          //   } `
          // );
        } else {
          warn(
            `${peer.id} Hmm, got block ${dumpBuf(
              lastKnownBlock
            )} time=${block.timestamp.toISOString()} but not understand where it is. Maybe good to save it`
          );
        }
      }
      performInitialHeadersDownload(peer);
    } else {
      if (currentlyFetchingHeadersPeerSentInvWithSomeBlock) {
        // Maybe something appeared during last headers transfer. Let's re-check
        currentlyFetchingHeadersPeerSentInvWithSomeBlock = false;
        performInitialHeadersDownload(peer);
      } else {
        // Ok, this peer have no idea about more blocks
        peersToFetchHeaders.splice(0, 1);

        if (peersToFetchHeaders.length > 0) {
          const nextPeerToFetchBlockheadersChain = peersToFetchHeaders[0];
          debug(
            `${peer.id} No more headers from this peer, picking new one ${nextPeerToFetchBlockheadersChain.id}`
          );
          performInitialHeadersDownload(nextPeerToFetchBlockheadersChain);
        } else {
          debug(
            `${peer.id} No more headers from this peer, no more peers in queue`
          );
        }

        if (!canFetchBlocks) {
          canFetchBlocks = true;
          givePeersTasksToDownloadBlocks();
        }
      }
    }

    const endedWithLastKnownId = storage.getLastKnownBlockId();
    if ((startedWithLastKnownId || 0) < (endedWithLastKnownId || 0)) {
      info(
        `${peer.id} Current height updated ${
          startedWithLastKnownId || "none"
        } -> ${endedWithLastKnownId || "none"}`
      );
    } else {
      debug(
        `${peer.id} Current height still = ${
          (storage.getLastKnownBlockId() || 0) - 1
        }`
      );
    }
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
            debug(
              `${peer.id} Got ipv4 addr but we have enough peers so ignoring ${addr.host}:${addr.port}`
            );
          } else {
            debug(
              `${peer.id} Got ipv4 addr, adding to the list ${addr.host}:${addr.port}`
            );
            connectToPeer([addr.host, addr.port]);
          }
        } else {
          debug(`${peer.id} Got ipv6 addr, ignoring ${addr.host}:${addr.port}`);
        }
      } else {
        debug(
          `${peer.id} Got addr which is already connected ${addr.host}:${addr.port}`
        );
      }

      addrCount--;
    }
  }

  function onBlockMessage(peer: PeerConnection, payload: BlockPayload) {
    const [block, rest] = readBlock(payload);
    if (rest.length !== 0) {
      warn(
        `${peer.id} Got some data after block message ${rest.toString("hex")}`
      );
      peer.close();
      return;
    }

    if (!canFetchBlocks) {
      // Special case: fetching genesis header
      if (!block.hash.equals(genesisBlockHash)) {
        warn(
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
      warn(`${peer.id} unknown block ${dumpBuf(block.hash)}`);
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
      .getBlockWithoutTransactionsInfo(1)
      .shift();
    if (!storageExpectingBlock) {
      throw new Error(
        `Storage error: why this block ${dumpBuf(
          block.hash
        )} was fetched if nothing expected there?`
      );
    }

    const downloadInfo =
      `${(payload.length / 1000 / 1000).toFixed(2)}mb ` +
      `in ${durationSeconds}s ${speedMbs}mb/s`;

    if (storageExpectingBlock.hash.equals(block.hash)) {
      info(
        `Blocks: ${peer.id} downloaded ${dumpBuf(block.hash)} ` +
          `${block.timestamp.toISOString()} ${downloadInfo}`
      );

      // TODO: Validate block
      newBlockListeners.forEach((cb) =>
        cb(block, storageExpectingBlock.id - 1)
      );
      storage.saveBlockTransactions(block.hash, block.transactions);

      flushBlockBufferIfPossible();
    } else {
      debug(
        `Blocks: ${peer.id} downloaded ${dumpBuf(block.hash)} ` +
          `${downloadInfo}, keeping data in buffer`
      );
      bufferedBlocks.set(block.hash.toString("hex"), [
        block,
        downloadInfo,
        peer.id,
      ]);
    }
    if (!storage.getBlockWithoutTransactionsInfo(1)) {
      info(`Blocks: all blocks downloaded`);
    }
    givePeersTasksToDownloadBlocks();
  }

  function flushBlockBufferIfPossible() {
    while (true) {
      const nextExpectingBlock = storage
        .getBlockWithoutTransactionsInfo(1)
        .shift();
      if (!nextExpectingBlock) {
        break;
      }
      const blockInBuffer = bufferedBlocks.get(
        nextExpectingBlock.hash.toString("hex")
      );
      if (!blockInBuffer) {
        break;
      }

      info(
        `Blocks: ${blockInBuffer[2]} downloaded ` +
          `${dumpBuf(nextExpectingBlock.hash)} ` +
          `${blockInBuffer[0].timestamp.toISOString()}` +
          `${blockInBuffer[1]} (buf)`
      );

      // TODO: Validate block
      newBlockListeners.forEach((cb) =>
        cb(blockInBuffer[0], nextExpectingBlock.id - 1)
      );
      storage.saveBlockTransactions(
        blockInBuffer[0].hash,
        blockInBuffer[0].transactions
      );

      bufferedBlocks.delete(nextExpectingBlock.hash.toString("hex"));
    }
  }

  function onNotFoundMessage(peer: PeerConnection, payload: MessagePayload) {
    for (const item of readNotFoundPayload(payload)) {
      if (item[0] === HashType.MSG_WITNESS_BLOCK) {
        const blockHash = item[1];
        const expectingBlockHash = peersBlocksTasks.get(peer);
        if (!expectingBlockHash || !expectingBlockHash.equals(blockHash)) {
          warn(`${peer.id} unknown notfound for block ${dumpBuf(item[1])}`);
          peer.close();
        } else {
          debug(`Blocks: ${peer.id} do not have ${blockHash}`);
          // Sad that this peer do not have this block. Let's hope others will have it
          peersBlocksTasks.delete(peer);
          blocksDownloadingNowStartedAt.delete(
            expectingBlockHash.toString("hex")
          );
          givePeersTasksToDownloadBlocks();
        }
      } else {
        warn(`${peer.id} unknown notfound ${item[0]} ${dumpBuf(item[1])}`);
        peer.close();
      }
    }
  }

  function givePeersTasksToDownloadBlocks() {
    if (!canFetchBlocks) {
      throw new Error(`Internal error: this should never be called`);
    }
    if (bufferedBlocks.size >= MAX_BUFFERED_BLOCKS) {
      debug(`Blocks: buffer is full!`);
      // We already have a lot data which is unprocessed yet
      return;
    }
    const blocksWithoutTransactionsData =
      storage.getBlockWithoutTransactionsInfo(MAX_BUFFERED_BLOCKS);
    if (blocksWithoutTransactionsData.length === 0) {
      debug(`Blocks: no more blocks without data`);
      return;
    }
    const blocksToDownload = blocksWithoutTransactionsData.filter(
      (blockInfo) => {
        const notDownloadingNow = !blocksDownloadingNowStartedAt.has(
          blockInfo.hash.toString("hex")
        );
        const notInBuffer = !bufferedBlocks.has(blockInfo.hash.toString("hex"));
        return notDownloadingNow && notInBuffer;
      }
    );

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
    debug(
      `Blocks: max=${MAX_DOWNLOADING_PEERS} ` +
        `bufAvailable=${thresholdOfBuffer} freePeers=${freePeers.length} ` +
        `blockToDownload=${blocksToDownload.length} ` +
        `startJobs=${availablePeersForDownloading.length}`
    );
    for (const [i, peer] of availablePeersForDownloading.entries()) {
      const blockInfo = blocksToDownload[i];
      if (!blockInfo) {
        throw new Error(`Internal error`);
      }
      debug(
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

  function getSavedBlock(
    blockLocator: BlockHash | BlockId
  ): BitcoinBlock | null {
    const blockMeta = storage.getBlockHeader(blockLocator);

    if (!blockMeta) {
      return null;
    }
    const transactionsPayload = storage.getBlockTransactions(blockMeta.id);

    const [block, rest] = readBlock(
      joinBuffers(
        blockMeta.header,
        packVarInt(transactionsPayload.length),
        ...transactionsPayload
      ) as BlockPayload
    );
    if (rest.length !== 0) {
      throw new Error(`Db error`);
    }
    return block;
  }

  function pruneSavedTxes(keepLastNBlocks: number) {
    storage.pruneSavedTxes(keepLastNBlocks);
  }

  function connectToBootstapPeers() {
    for (const addr of bootstrapPeers) {
      connectToPeer(addr);
    }
  }

  // Connect to peers after small delay so if someone wants
  // to do syncronous stuff on startup connections will not be blocked
  setTimeout(() => {
    connectToBootstapPeers();
  }, 1);

  const startingLastKnownBlockId = storage.getLastKnownBlockId();
  info(
    `Bitcoin node created, starting height=${
      startingLastKnownBlockId ? startingLastKnownBlockId - 1 : "<none>"
    }`
  );

  const me: BitcoinNodeApi = {
    destroy() {
      throw new Error(`Not implemented`);
    },
    getSavedBlock: getSavedBlock,
    pruneSavedTxes,
    onNewDownloadedBlock: buildSubscriber(newBlockListeners),
  };
  return me;
}

function buildSubscriber<T extends Function>(
  listeners: T[]
): SubscribeEvent<T> {
  return (cb) => {
    listeners.push(cb);
    return () => {
      const idx = listeners.indexOf(cb);
      if (idx < 0) {
        throw new Error(`Unable to unsubscribe`);
      }
      listeners.splice(idx, 1);
    };
  };
}
