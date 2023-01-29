import Database from "better-sqlite3";
import { genesisBlockHash } from "../bitcoin/consts";
import { BlockHash } from "../bitcoin/messages.types";
import { Nominal } from "../nominal_types/nominaltypes";

export type BlockId = Nominal<"block id", number>;
export type BlockDB = {
  id: BlockId;
  hash: BlockHash;
};
export function createTransactionsStorage(isMemory = false) {
  const blockchain = new Database(
    isMemory ? ":memory:" : __dirname + "/transactions.db"
  );

  blockchain.pragma("journal_mode = WAL");
  blockchain.pragma("auto_vacuum = FULL");
  blockchain.exec(`
  CREATE TABLE IF NOT EXISTS unspent_transaction_output  (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    transaction_hash CHARACTER(32) NOT NULL, 
    output_id INTEGER NOT NULL,
    pub_script CHARACTER(32) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signatures  (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    compressed_public_key CHARACTER(33) NOT NULL, 
    msg CHARACTER (32) NOT NULL,
    r CHARACTER(32) NOT NULL,
    s CHARACTER(32) NOT NULL,
    spending_tx_hash CHARACTER(32) NOT NULL,
    spending_tx_input_index INTEGER NOT NULL
  );

`);

  function pushNewBlockHash(hash: BlockHash) {
    blockchain.prepare(`INSERT INTO blocks (hash) VALUES (?)`).run(hash);
  }

  const firstBlock = blockchain
    .prepare("SELECT * FROM blocks WHERE id = 1")
    .get();
  if (!firstBlock) {
    console.info("Creating data for the first block");
    pushNewBlockHash(genesisBlockHash);
  }

  function getLastKnownBlocks(n = 10): BlockDB[] {
    const blocks = blockchain
      .prepare(`select id, hash from blocks order by id desc limit ?`)
      .all(n);

    return blocks;
  }

  function pushNewKnownBlock(hash: BlockHash) {
    // TODO: Accept block itself and check that it actually points to the previous block
    pushNewBlockHash(hash);
  }

  function getNextUprocessedBlocks(n = 10): BlockDB[] {
    const blocks = blockchain
      .prepare(
        `select id, hash from blocks where not is_processed order by id limit ?`
      )
      .all(n);

    return blocks;
  }

  function markBlockAsProccessed(id: BlockId) {
    blockchain
      .prepare(`update blocks set is_processed = true where id = ?`)
      .run(id);
  }

  return {
    getLastKnownBlocks,
    pushNewKnownBlock,
    getNextUprocessedBlocks,
    markBlockAsProccessed,
  };
}
