import {
  BitcoinBlock,
  BitcoinTransaction,
} from "../bitcoin.protocol/messages.parse";
import { BlockHash, TransactionHash } from "../bitcoin.protocol/messages.types";
import { BlockId } from "./node.storage";

export type NewBlockListener = (
  block: BitcoinBlock,
  currentHeight: number
) => void;
export type SubscribeEvent<T extends Function> = (cb: T) => () => void;
export interface BitcoinNodeApi {
  // getTransaction(txId: TransactionHash): BitcoinTransaction;
  getSavedBlock(blockHash: BlockHash | BlockId): BitcoinBlock | null;
  pruneSavedTxes(keepLastNBlocks: number): void;
  destroy(): void;
  onNewDownloadedBlock: SubscribeEvent<NewBlockListener>;

  //  getSavedBlocks(
  //    cursorName: string,
  //    onBlock: (block: BitcoinBlock, isFromDatabase: boolean) => void
  //  ): void;
}
