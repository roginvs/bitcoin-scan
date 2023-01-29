import { Nominal } from "../nominal_types/nominaltypes";

export type BitcoinMessage = Nominal<"bitcoin message", Buffer>;
export type MessagePayload = Nominal<"message payload", Buffer>;

export type BlockHash = Nominal<"block hash", Buffer>;
export type TransationHash = Nominal<"transaction hash", Buffer>;
export type MerkleRootHash = Nominal<"merkle root hash", Buffer>;

export type BlockPayload = Nominal<"block payload", Buffer>;
export type TransactionPayload = Nominal<"transaction payload", Buffer>;

export type PkScript = Nominal<"public key script of tx_out", Buffer>;
export type SignatureScript = Nominal<"signature script of tx_in", Buffer>;

export enum HashType {
  /** Any data of with this number may be ignored */
  ERROR = 0,
  /** Hash is related to a transaction */
  MSG_TX = 1,
  /** Hash is related to a data block */
  MSG_BLOCK = 2,
  /** Hash of a block header; identical to MSG_BLOCK. Only to be used in getdata message. Indicates the reply should be a merkleblock message rather than a block message; this only works if a bloom filter has been set. See BIP 37 for more info. */
  MSG_FILTERED_BLOCK = 3,
  /** Hash of a block header; identical to MSG_BLOCK. Only to be used in getdata message. Indicates the reply should be a cmpctblock message. See BIP 152 for more info. */
  MSG_CMPCT_BLOCK = 4,
  /** Hash of a transaction with witness data. See BIP 144 for more info. */
  MSG_WITNESS_TX = 0x40000001,
  /** Hash of a block with witness data. See BIP 144 for more info. */
  MSG_WITNESS_BLOCK = 0x40000002,
  /** Hash of a block with witness data. Only to be used in getdata message. Indicates the reply should be a merkleblock message rather than a block message; this only works if a bloom filter has been set. See BIP 144 for more info. */
  MSG_FILTERED_WITNESS_BLOCK = 0x40000003,
}

export type InventoryItem =
  | [type: HashType.MSG_TX, value: TransationHash]
  | [type: HashType.MSG_BLOCK, value: BlockHash];
