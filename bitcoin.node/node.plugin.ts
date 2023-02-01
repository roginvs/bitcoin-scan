import {
  BitcoinBlock,
  BitcoinTransaction,
} from "../bitcoin.protocol/messages.parse";
import { BlockHash, TransactionHash } from "../bitcoin.protocol/messages.types";

export interface BitcoinNodeApi {
  getTransaction(txId: TransactionHash): BitcoinTransaction;
  getBlock(blockHash: BlockHash): BitcoinBlock;

  // getSavedBlocks(cursorName: string, onBlock: (block: BitcoinBlock) => void): void
}

export interface BitcoinNodePlugin {
  onCreate: (api: BitcoinNodeApi) => void;

  /**
   * This is called when new block is fetched.
   * Starting from the bottom of the blockchain.
   * When callback returns then state is saved into database
   *
   */
  onNewValidatedBlock?: (block: BitcoinBlock) => void;
}
