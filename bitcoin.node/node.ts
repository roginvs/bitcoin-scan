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
import { createPeer, PeerConnection } from "../bitcoin.protocol/peer.outgoing";
import { BitcoinNodePlugin } from "./node.plugin";
import { createNodeStorage } from "./node.storage";

export type PeerAddr = [string, number];

function dumpBuf(buf: Buffer) {
  return Buffer.from(buf).reverse().toString("hex");
}
export function createBitcoinNode(
  bootstrapPeers: PeerAddr[],
  saveOnlyLastNBlocks?: number,
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
    const peer = createPeer(addr[0], addr[1], currentLastKnownBlockId - 1);
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
    peer.send(createGetheadersMessage(fewLastKnownBlocks));
    peer.raiseWatchdog("headers");
  }

  function onMessage(
    peer: PeerConnection,
    cmd: string,
    payload: MessagePayload
  ) {
    if (cmd === "") {
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
    } else if (cmd === "headers") {
      onHeadersMessage(peer, payload);
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

          const lastKnownBlockIdInDb = storage.getLastKnownBlockId();

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

  return {
    destroy() {
      throw new Error(`Not implemented`);
    },
  };
}
