import Database from "better-sqlite3";
import { genesisBlockHash } from "../bitcoin.protocol/consts";
import { BitcoinBlock } from "../bitcoin.protocol/messages.parse";
import { BlockHash, BlockPayload } from "../bitcoin.protocol/messages.types";
import { Nominal } from "../nominal_types/nominaltypes";

function getDbPath(dbFileName: string) {
  const dataFolder = process.env.NODE_STORAGE_DIR;
  if (!dataFolder) {
    throw new Error(`Env variable NODE_STORAGE_DIR is not defined`);
  }
  return dataFolder + "/" + dbFileName;
}

export type BlockId = Nominal<"block numeric id", number>;

export function createNodeStorage(isMemory = false) {
  const sql = new Database(isMemory ? ":memory:" : getDbPath("blockchain.db"));

  sql.pragma("journal_mode = WAL");
  sql.pragma("auto_vacuum = FULL");

  sql.exec(`
    CREATE TABLE IF NOT EXISTS headerschain (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      hash CHARACTER(32) NOT NULL,
      header CHARACTER(80) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS block_hash ON headerschain (hash);

    CREATE TABLE IF NOT EXISTS block_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      txid CHARACTER(32) NOT NULL,      
      block_id INTEGER,
      block_index INTEGER NOT NULL,
      data BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transaction_hash ON block_transactions (txid);
    CREATE INDEX IF NOT EXISTS transaction_block_id ON block_transactions (block_id);    
    -- CREATE INDEX IF NOT EXISTS transaction_block_id ON block_transactions (block_id, block_index);

`);

  function getLastKnownBlocksHashes(n = 10): BlockHash[] {
    const blockHashes = sql
      .prepare(`select hash from blockchain order by id desc limit ?`)
      .all(n)
      .map((row) => row.hash);

    return blockHashes;
  }

  function pushNewBlockHeader(hash: BlockHash, blockHeader: BlockPayload) {
    sql
      .prepare(
        `
      insert into headerschain (hash, header) values ?
    `
      )
      .run(hash, blockHeader.subarray(0, 4 + 32 + 32 + 4 + 4 + 4));
  }

  function pruneLastNBlocksData(n: number) {
    const dbId = sql
      .prepare(
        `
          select id from blockchain order by id desc limit 1 offset ?
        `
      )
      .get().id;
    sql
      .prepare(
        `
        delete from blocks where id < ?
      `
      )
      .run(dbId);
  }

  function getLastKnownBlockId() {
    const dbId = sql
      .prepare(
        `
            select id from blockchain order by id desc limit 1`
      )
      .get()!.id as BlockId;
    return dbId;
  }

  return {
    getLastKnownBlocksHashes,
    pushNewBlockHeader,
    pruneLastNBlocksData,
    getLastKnownBlockId,
  };
}
