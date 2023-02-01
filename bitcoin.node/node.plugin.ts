import {
  BitcoinBlock,
  BitcoinTransaction,
} from "../bitcoin.protocol/messages.parse";
import { BlockHash, TransactionHash } from "../bitcoin.protocol/messages.types";

export type NewBlockListener = (block: BitcoinBlock) => void;
export type SubscribeEvent<T extends Function> = (cb: T) => () => void;
export interface BitcoinNodeApi {
  // getTransaction(txId: TransactionHash): BitcoinTransaction;
  getBlock(blockHash: BlockHash): BitcoinBlock;
  pruneSavedTxes(keepLastNBlocks: number): void;
  destroy(): void;
  onNewValidatedBlock: SubscribeEvent<NewBlockListener>;

  // getSavedBlocks(cursorName: string, onBlock: (block: BitcoinBlock) => void): void
}
