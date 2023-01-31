import { BitcoinBlock } from "./messages.parse";
import { BlockHash, TransactionHash } from "./messages.types";
import { NodeStorage } from "./node.storage";

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
  onNewBlock?: (block: BitcoinBlock) => void
) {
  /*
    Simple implementation:
        - We connect to the first peer
        - Do "getheaders"
        - Receive headers, check that we got our previous
          - For each header ask for a block
          -
        - When it is done then check "inv" messages
        
        - If disconnected then connect to next
        

    */

  const me = {
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

  return me;
}
