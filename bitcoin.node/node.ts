import { genesisBlockHash } from "../bitcoin.protocol/consts";
import {
  createGetdataMessage,
  createGetheadersMessage,
} from "../bitcoin.protocol/messages.create";
import {
  BitcoinBlock,
  readAddrWithTime,
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
import { createPeer, PeerConnection } from "../bitcoin.protocol/peer.outgoing";
import { BitcoinNodePlugin } from "./node.plugin";
import { createNodeStorage } from "./node.storage";

export type PeerAddr = [string, number];

function dumpBuf(buf: Buffer) {
  return Buffer.from(buf).reverse().toString("hex");
}
export function createBitcoinNode(
  bootstrapPeers: PeerAddr[],
  plugins: BitcoinNodePlugin[] = []
) {
  const storage = createNodeStorage();

  /*

Algoritm:
- On startup push genenis block if blockchain is empty
- state = "headers chain download"
  - Array of peerConnections (peer.onMessage = (command, payload) => onMessage(peer, command, payload))
- Connect to bootstrap peers
  - Listen to "addr" message, if peers count < PEERS_COUNT then connect there too
  - Listen to "inv" message too
- Use "blocksInvReceivedDuruingHeadersChainDownload" = Map<PeerConnection, BlockHash[]>
  - remove map item when peer disconnects
  - push "inv" blockhash to this array if state = "headers chain download"

- Use as array of peersToPerformInitialHeadersChainDownload
   - If this array is empty (or null) then initial headers chain download is done
   - check is it done when:
     - peer have no blockchain in headers message
     - anywhere else ?
     
- When peer is handshaked do:
  - push peer to all objects
  - If state is "headers chain download":
    - If peer is first in the currenlyInitialHeadersDownloadingPeer list then start headers process
- If peer is disconnected:
    - remove it from peersToPerformInitialHeadersChainDownload
    - if it was first there then start for the next peer

  
*/

  const MAX_PEERS = 10;

  const peers: PeerConnection[] = [];

  let peersToPerformInitialHeadersChainDownload: PeerConnection[] | null = [];

  function connectToPeer(addr: PeerAddr) {
    const currentLastKnownBlockId = storage.getLastKnownBlockId();
    console.info(`Creating new peer ${addr[0]}:${addr[1]}`);
    const peer = createPeer(
      addr[0],
      addr[1],
      currentLastKnownBlockId ? currentLastKnownBlockId - 1 : 0
    );
    peer.onMessage = (cmd, payload) => onMessage(peer, cmd, payload);
    peers.push(peer);

    if (peersToPerformInitialHeadersChainDownload) {
      peersToPerformInitialHeadersChainDownload.push(peer);
      if (peersToPerformInitialHeadersChainDownload.length === 1) {
        performInitialHeadersDownload(peer);
      }
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

    if (
      peersToPerformInitialHeadersChainDownload &&
      peersToPerformInitialHeadersChainDownload[0] === peer
    ) {
      // This peer was in the downloading phase
      peersToPerformInitialHeadersChainDownload.splice(0, 1);
      if (peersToPerformInitialHeadersChainDownload.length > 0) {
        // Switch to another peer
        performInitialHeadersDownload(
          peersToPerformInitialHeadersChainDownload[0]
        );
      } else {
        // It means we do not have any peers more. We will not get any new peers
        // So the best is to terminate
        throw new Error(`No candidates for initial blockheaders download`);
      }
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
    }
  }

  function onHeadersMessage(peer: PeerConnection, payload: MessagePayload) {
    if (!peersToPerformInitialHeadersChainDownload) {
      console.warn(`Got headers but we are not in the headers fetching state`);
      return;
    }
    if (peersToPerformInitialHeadersChainDownload[0] !== peer) {
      console.warn(`Got headers from the wrong peer`);
      return;
    }

    peer.clearWatchdog("headers");

    let lastKnownBlock = storage.getLastKnownBlocksHashes().slice().shift()!;

    let [count, headers] = readVarInt(payload);
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
          storage.pushNewBlockHeader(block.hash, headersRaw);

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

          const lastKnownBlockIdInDb = storage.getLastKnownBlockId()!;

          console.info(
            `${peer.id} Got new block ${dumpBuf(
              lastKnownBlock
            )} time=${block.timestamp.toISOString()} current height = ${
              lastKnownBlockIdInDb - 1
            } `
          );
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
      peersToPerformInitialHeadersChainDownload.splice(0, 1);
      if (peersToPerformInitialHeadersChainDownload.length > 0) {
        const nextPeerToFetchBlockheadersChain =
          peersToPerformInitialHeadersChainDownload[0];
        console.info(
          `${peer.id} No more headers from this peer, picking new one ${nextPeerToFetchBlockheadersChain.id}`
        );
        performInitialHeadersDownload(nextPeerToFetchBlockheadersChain);
      } else {
        console.info(
          `${peer.id} No more headers from this peer, no more peers in queue, starting to fetch blocks data`
        );
        peersToPerformInitialHeadersChainDownload = null;
        console.info(`TODO: Headers are fetched, start to fetch blocks`);
      }
    }
  }

  function onAddrMessage(peer: PeerConnection, payload: MessagePayload) {
    let addrCount;
    let buf: Buffer = payload;
    [addrCount, buf] = readVarInt(buf);
    while (addrCount > 0) {
      const [addr, rest] = readAddrWithTime(buf);
      buf = rest;

      if (addr.ipFamily === 4) {
        if (peers.length > MAX_PEERS) {
          console.info(
            `Got ipv4 addr but we have enough peers so ignoring:\n`,
            addr
          );
        } else {
          console.info(`Got ipv4 addr, adding to the list:\n`, addr);
          connectToPeer([addr.addr, addr.port]);
        }
      } else {
        console.info(`Got ipv6 addr, ignoring:\n`, addr);
      }

      addrCount--;
    }
  }

  function onBlockMessage(peer: PeerConnection, payload: BlockPayload) {
    const [block, rest] = readBlock(payload);
    if (rest.length !== 0) {
      console.warn(`Got some data after block message ${rest.toString("hex")}`);
      peer.close();
      return;
    }

    if (peersToPerformInitialHeadersChainDownload) {
      // Special case: fetching genesis header
      if (!block.hash.equals(genesisBlockHash)) {
        console.warn(
          `Got unknown block hash during initial chain download ${dumpBuf(
            block.hash
          )}`
        );
        peer.close();
        return;
      }

      storage.pushNewBlockHeader(block.hash, payload);
      peer.clearWatchdog("genesis block data");
      performInitialHeadersDownload(peer);
      return;
    }

    throw new Error("TODO");
  }

  for (const addr of bootstrapPeers) {
    connectToPeer(addr);
  }

  return {
    destroy() {
      throw new Error(`Not implemented`);
    },
  };
}
