import { genesisBlockHash } from "../protocol/consts";

import {
  buildMessage,
  createGetdataMessage,
  createGetheadersMessage,
  createNotfoundMessage,
  packTx,
  packVarInt,
} from "../protocol/messages.create";
import {
  BitcoinBlock,
  readAddrWithTime,
  readBlock,
  readGetdataPayload,
  readGetheadersMessage,
  readInvPayload,
  readNotFoundPayload,
  readTx,
  readVarInt,
} from "../protocol/messages.parse";
import {
  BlockHash,
  BlockPayload,
  HashType,
  InventoryItem,
  MessagePayload,
  TransactionHash,
} from "../protocol/messages.types";
import {
  createIncomingPeer,
  createOutgoingPeer,
  PeerConnection,
} from "../protocol/peer";
import { joinBuffers } from "../utils/joinBuffer";
import { BlockDbId, createNodeStorage } from "./blockchain.node.storage";
import { createLogger } from "../../logger/logger";
import { createServer, Socket } from "net";
import { buildSubscriber } from "../subscriber";

const { info, debug, warn } = createLogger("NODE");

export type PeerAddr = readonly [string, number];

export type BeforeBlockSavedListener = (
  block: BitcoinBlock,
  currentHeight: number
) => void;

export type AfterBlockSavedListener = (
  block: BitcoinBlock,
  blockDbId: BlockDbId
) => void;

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

export function createBitcoinBlocksNode() {
  const bootstrapPeers = getBootstrapPeers();

  const storage = createNodeStorage();

  /*

Algoritm:
  - On startup fetch genenis block if blockchain is empty
  - Fetch headers chain from the first peer
    - When it is done start to download blocks data
  - On each new peer fetch headers chain
    - But only one peer at time


  
*/

  const beforeBlockSavedListeners: BeforeBlockSavedListener[] = [];
  const afterBlockSavedListeners: AfterBlockSavedListener[] = [];

  const MAX_OUTGOING_PEERS = 10;
  const MAX_INCOMING_PEERS = 30;
  const MAX_DOWNLOADING_PEERS = 5;
  const MAX_BUFFERED_BLOCKS = 15;

  const peers: PeerConnection[] = [];
  let outgoingPeersCount = 0;
  let incomingPeersCount = 0;
  /**
   * This is a queue of peers to fetch headers chain.
   * We fetching chain only from one peer at time so first item in this array
   * is peer from which we are fetching
   */
  const peersToFetchHeaders: PeerConnection[] = [];
  let currentlyFetchingHeadersPeerSentInvWithSomeBlock = false;

  /** We can fetch blocks when we have updated blockchain from at least one peer */
  let canFetchBlocks = false;

  // Fething only one block from the peer at time.
  // Blocks are big enough, no need to request simultaneously multiple blocks
  const peersBlocksTasks = new Map<PeerConnection, BlockHash>();
  // We can not compare buffers directly so we use string here
  const blocksDownloadingNowStartedAt = new Map<string, Date>();
  const bufferedBlocks = new Map<
    string,
    [block: BitcoinBlock, downloadInfo: string, peerId: string]
  >();

  function connectToPeer(
    peerInfo:
      | {
          isOutgoing: true;
          addr: PeerAddr;
        }
      | {
          isOutgoing: false;
          socket: Socket;
        }
  ) {
    const currentLastKnownBlockDbId = storage.getLastKnownBlockDbId();
    const lastKnownHeight = currentLastKnownBlockDbId
      ? currentLastKnownBlockDbId - 1
      : 0;

    if (peerInfo.isOutgoing) {
      outgoingPeersCount++;
    } else {
      incomingPeersCount++;
    }

    info(
      `Creating new peer ` +
        (peerInfo.isOutgoing
          ? `outgoing ${peerInfo.addr[0]}:${peerInfo.addr[1]}`
          : `incoming ${peerInfo.socket.remoteAddress}:${peerInfo.socket.remotePort}`) +
        `, count=${peers.length + 1}`
    );
    const peer = peerInfo.isOutgoing
      ? createOutgoingPeer(peerInfo.addr[0], peerInfo.addr[1], lastKnownHeight)
      : createIncomingPeer(peerInfo.socket, lastKnownHeight);
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
      debug(`${peer.id} asking for genesis block data`);
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
    if (peer.isOutgoing) {
      outgoingPeersCount--;
    } else {
      incomingPeersCount--;
    }

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
      onGetHeaders(peer, payload);
    } else if (cmd === "getdata") {
      onGetData(peer, payload);
    } else if (cmd === "mempool") {
      warn(`Got mempool request`);
    } else {
      debug(`${peer.id} unknown message ${cmd}`);
    }
  }

  function onGetHeaders(peer: PeerConnection, payload: MessagePayload) {
    const [data, rest] = readGetheadersMessage(payload);
    if (rest.length > 0) {
      warn(
        `${peer.id} Some data is left in getheaders request`,
        rest.toString("hex")
      );
      return;
    }
    debug(`${peer.id} asks for headers`);
    for (const blockHash of data.hashes) {
      const info = storage.getBlockHeader(blockHash);
      if (!info) {
        debug(`  - header ${dumpBuf(blockHash)} is not found in our chain`);
        continue;
      }
      const blockStopId = data.hashStop.equals(Buffer.alloc(32, 0))
        ? undefined
        : storage.getBlockHeader(data.hashStop)?.id;
      const headersWeKnow = storage.getBlocksHeaders(
        info.id,
        Math.min(2000, blockStopId ? blockStopId - info.id : 2000)
      );
      const len = packVarInt(headersWeKnow.length);
      const responsePayload = joinBuffers(
        len,
        ...headersWeKnow.flatMap((header) => [header, Buffer.from([0])])
      ) as MessagePayload;

      debug(
        `  - header ${dumpBuf(blockHash)} found, h=${info.id} ` +
          `stopId=${blockStopId ? blockStopId : "none"} ` +
          `resultLen=${headersWeKnow.length}`
      );
      peer.send(buildMessage("headers", responsePayload));
      break;
    }
  }
  function onGetData(peer: PeerConnection, payload: MessagePayload) {
    const inventories = readGetdataPayload(payload);
    const notFoundInventories: InventoryItem[] = [];
    for (const inv of inventories) {
      if (inv[0] === HashType.MSG_BLOCK) {
        const block = getSavedBlockRaw(inv[1], true)?.[0];
        if (block) {
          peer.send(buildMessage("block", block as Buffer as MessagePayload));
        } else {
          notFoundInventories.push(inv);
        }
      } else if (inv[0] === HashType.MSG_WITNESS_BLOCK) {
        const block = getSavedBlockRaw(inv[1])?.[0];
        if (block) {
          peer.send(buildMessage("block", block as Buffer as MessagePayload));
        } else {
          notFoundInventories.push(inv);
        }
      } else {
        warn(
          `${peer.id} asked for data ${
            inv[0]
          } but we do not have such ${inv[1].toString("hex")}`
        );
        notFoundInventories.push(inv);
      }
    }
    peer.send(createNotfoundMessage(notFoundInventories));
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
    for (const inv of data) {
      if (inv[0] !== HashType.MSG_TX) {
        continue;
      }
      const txId = inv[1];
      if (!storage.isMempoolTxExists(txId)) {
        // debug(`${peer.id} announce tx ${dumpBuf(txId)}`);
        // TODO: Maybe we fetching the same txid from some other peer
      }
    }
    if (data.filter((inv) => inv[0] === HashType.MSG_WITNESS_TX).length > 0) {
      warn(`${peer.id} provided inv with MSG_WITNESS_TX`);
    }
  }

  function onHeadersMessage(peer: PeerConnection, payload: MessagePayload) {
    if (peersToFetchHeaders[0] !== peer) {
      warn(`${peer.id} Got headers from the wrong peer`);
      return;
    }

    peer.clearWatchdog("headers");

    let lastKnownBlock = storage.getLastKnownBlocksHashes().slice().shift()!;

    const startedWithLastKnownDbId = storage.getLastKnownBlockDbId();

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

    const endedWithLastKnownId = storage.getLastKnownBlockDbId();
    if ((startedWithLastKnownDbId || 0) < (endedWithLastKnownId || 0)) {
      info(
        `${peer.id} Current height updated ${
          startedWithLastKnownDbId || "none"
        } -> ${endedWithLastKnownId || "none"}`
      );
      if (canFetchBlocks) {
        givePeersTasksToDownloadBlocks();
      }
    } else {
      debug(
        `${peer.id} Current height still = ${
          (storage.getLastKnownBlockDbId() || 0) - 1
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
          if (outgoingPeersCount > MAX_OUTGOING_PEERS) {
            debug(
              `${peer.id} Got ipv4 addr but we have enough peers so ignoring ${addr.host}:${addr.port}`
            );
          } else {
            debug(
              `${peer.id} Got ipv4 addr, adding to the list ${addr.host}:${addr.port}`
            );

            connectToPeer({
              isOutgoing: true,
              addr: [addr.host, addr.port],
            });
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

      processBlockData(block, storageExpectingBlock.id);
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
    if (storage.getBlockWithoutTransactionsInfo(1).length === 0) {
      info(`Blocks: all blocks downloaded`);
    }
    givePeersTasksToDownloadBlocks();
  }

  function processBlockData(block: BitcoinBlock, blockDbId: BlockDbId) {
    beforeBlockSavedListeners.forEach((cb) => cb(block, blockDbId));
    storage.saveBlockTransactions(block.hash, block.transactions);
    afterBlockSavedListeners.forEach((cb) => cb(block, blockDbId));
    storage.pruneMempoolTransactions(block.transactions.map((tx) => tx.txid));
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

      processBlockData(blockInBuffer[0], nextExpectingBlock.id);

      bufferedBlocks.delete(nextExpectingBlock.hash.toString("hex"));
    }
  }

  function onNotFoundMessage(peer: PeerConnection, payload: MessagePayload) {
    for (const item of readNotFoundPayload(payload)) {
      if (item[0] === HashType.MSG_WITNESS_BLOCK) {
        if (!canFetchBlocks) {
          // Special case: fetching genesis header
          if (item[1].equals(genesisBlockHash)) {
            warn(`${peer.id} notfound genesis block ${dumpBuf(item[1])}`);
          } else {
            warn(
              `${
                peer.id
              } was asked for genesis block but returned not found for this ${dumpBuf(
                item[1]
              )}`
            );
          }
          peer.close();
        } else {
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
          blockInfo.id
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

  function getSavedBlockRaw(
    blockLocator: BlockHash | BlockDbId,
    removeWitnessInEachTransaction = false
  ) {
    const blockMeta = storage.getBlockHeader(blockLocator);

    if (!blockMeta) {
      return null;
    }
    const transactionsPayloads = storage
      .getBlockTransactions(blockMeta.id)
      .map((txData) => {
        if (!removeWitnessInEachTransaction) {
          return txData;
        }
        const tx = readTx(txData)[0];
        const repackedTx = packTx({
          ...tx,
          isWitness: false,
        });
        return repackedTx;
      });

    const data = joinBuffers(
      blockMeta.header,
      packVarInt(transactionsPayloads.length),
      ...transactionsPayloads
    ) as BlockPayload;
    return [data, blockMeta.id] as const;
  }
  function getSavedBlock(blockLocator: BlockHash | BlockDbId) {
    const data = getSavedBlockRaw(blockLocator);
    if (!data) {
      return null;
    }
    const [block, rest] = readBlock(data[0]);
    if (rest.length !== 0) {
      throw new Error(`Db error`);
    }
    return [block, data[1]] as const;
  }

  function removeOldBlocksData(keepLastNBlocks: number) {
    storage.pruneSavedTxes(keepLastNBlocks);
  }

  function connectToBootstapPeers() {
    for (const addr of bootstrapPeers) {
      connectToPeer({
        isOutgoing: true,
        addr,
      });
    }
  }

  setTimeout(() => {
    // We have to do it asynchronously so consumers can attach their callbacks
    flushCatchUpTasks();

    // Connect to peers after small delay so if someone wants
    // to do syncronous stuff on startup connections will not be blocked
    info(`Starting network connections...`);
    connectToBootstapPeers();
  }, 1);

  {
    const startingLastKnownBlockDbId = storage.getLastKnownBlockDbId();
    const startingLastBlockDbIdWithData = storage
      .getBlockWithoutTransactionsInfo(1)
      .shift()?.id;
    info(
      `Bitcoin node created, starting height=${
        startingLastKnownBlockDbId ? startingLastKnownBlockDbId - 1 : "<none>"
      } lastBlockWithDataHeight=${
        startingLastBlockDbIdWithData
          ? startingLastBlockDbIdWithData - 1
          : "<none>"
      }`
    );
  }

  const listeningPort = Number(process.env.NODE_LISTEN_PORT);
  if (!isNaN(listeningPort)) {
    const incomingServer = createServer((socket) => {
      if (incomingPeersCount > MAX_INCOMING_PEERS) {
        debug(
          `Already have enough incoming peers, rejecting ${socket.remoteAddress}:${socket.remotePort}`
        );
        socket.destroy();
      } else {
        connectToPeer({
          isOutgoing: false,
          socket,
        });
      }
    });
    incomingServer.on("listening", () => {
      info(`Listening at port ${listeningPort}`);
    });
    incomingServer.on("error", () => {
      throw new Error(`Failed to listen on port ${listeningPort}`);
    });
    incomingServer.listen(listeningPort);
  } else {
    info(`Not accepting incoming connections`);
  }

  let catchupTasks:
    | [
        lastBlockSelector: BlockHash | BlockDbId | null | undefined,
        onBlockCatchup: AfterBlockSavedListener
      ][]
    | null = [];
  function catchUpBlocks(
    lastBlockSelector: BlockHash | BlockDbId | null | undefined,
    onBlockCatchup: AfterBlockSavedListener
  ) {
    if (!catchupTasks) {
      throw new Error(
        `Too late to catch-up blocks, we alrady started connection. Do this earlier!`
      );
    }
    catchupTasks.push([lastBlockSelector, onBlockCatchup]);
  }

  function flushCatchUpTasks() {
    if (!catchupTasks) {
      throw new Error(`Internal error`);
    }

    for (const [lastBlockSelector, onBlockCatchup] of catchupTasks) {
      info(
        `Start to catch-up from ` +
          (lastBlockSelector
            ? typeof lastBlockSelector === "number"
              ? `${lastBlockSelector}`
              : dumpBuf(lastBlockSelector)
            : "<none>")
      );
      let cathingUpBlockIndex: BlockDbId | null;

      if (lastBlockSelector) {
        const blockInfo = getSavedBlock(lastBlockSelector);
        if (!blockInfo) {
          throw new Error(
            `Cannot catch-up because ${lastBlockSelector} is not found`
          );
        }

        debug(
          `Found processed block ${dumpBuf(blockInfo[0].hash)} id=${
            blockInfo[1]
          }, will continue with the next one`
        );

        cathingUpBlockIndex = blockInfo[1];
        cathingUpBlockIndex++;
      } else {
        const genesisInfo = getSavedBlock(genesisBlockHash);
        if (genesisInfo) {
          cathingUpBlockIndex = genesisInfo[1];
        } else {
          cathingUpBlockIndex = null;
        }
      }

      if (cathingUpBlockIndex === null) {
        debug(`Blockchain do not even have genesis so nothing to catch up`);
        continue;
      }

      while (true) {
        const block = getSavedBlock(cathingUpBlockIndex)?.[0];
        if (!block || block.transactions.length === 0) {
          break;
        }

        info(
          `Catching up block ${dumpBuf(
            block.hash
          )} id=${cathingUpBlockIndex} date=${block.timestamp.toISOString()}`
        );
        onBlockCatchup(block, cathingUpBlockIndex);

        cathingUpBlockIndex++;
      }
      info(`Done with this catch up`);
    }

    catchupTasks = null;
  }

  const me = {
    destroy() {
      throw new Error(`Not implemented`);
    },
    getSavedBlock,
    removeOldBlocksData,
    onBeforeBlockSaved: buildSubscriber(beforeBlockSavedListeners),
    onAfterBlockSaved: buildSubscriber(afterBlockSavedListeners),
    catchUpBlocks,
  };

  return me;
}
