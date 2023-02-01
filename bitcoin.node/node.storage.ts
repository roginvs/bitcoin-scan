function getDbPath(dbFileName: string) {
  const dataFolder = process.env.NODE_STORAGE_DIR;
  if (!dataFolder) {
    throw new Error(`Env variable NODE_STORAGE_DIR is not defined`);
  }
  return dataFolder + "/" + dbFileName;
}

import Database from "better-sqlite3";
import { genesisBlockHash } from "../bitcoin.protocol/consts";
import { BitcoinBlock } from "../bitcoin.protocol/messages.parse";
import { BlockHash, BlockPayload } from "../bitcoin.protocol/messages.types";
export function createNodeStorage(isMemory = false) {
  const sql = new Database(isMemory ? ":memory:" : getDbPath("blockchain.db"));

  sql.pragma("journal_mode = WAL");
  sql.pragma("auto_vacuum = FULL");

  sql.exec(`
    CREATE TABLE IF NOT EXISTS blockchain (
      block_id INTEGER PRIMARY KEY AUTOINCREMENT, 
      hash CHARACTER(32) NOT NULL,
      header CHARACTER(80) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS block_hash ON blockchain (hash);

    CREATE TABLE IF NOT EXISTS block_transactions (
      block_id INTEGER PRIMARY KEY,
      txhash CHARACTER(32) NOT NULL,
      index_in_the_block INTEGER NOT NULL,
      data BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transaction_hash ON block_transactions (txhash);

    
`);

  function getLastKnownBlocksHashes(n = 10): BlockHash[] {
    const blockHashes = sql
      .prepare(`select hash from blockchain order by id desc limit ?`)
      .all(n)
      .map((row) => row.hash);

    return blockHashes;
  }

  function pushNewKnownBlock(block: BitcoinBlock, rawData: BlockPayload) {
    sql
      .prepare(
        `
      insert into blockchain (hash) values ?
    `
      )
      .run(block.hash);
    const dbId = sql.prepare("select last_insert_rowid() as id").get().id;
    sql
      .prepare(
        `
      insert into blocks (id, data) values (?, ?)
    `
      )
      .run(dbId, rawData);
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
      .get()?.id as number | undefined;
    return dbId;
  }

  return {
    getLastKnownBlocksHashes,
    pushNewKnownBlock,
    pruneLastNBlocksData,
    getLastKnownBlockId,
  };
}
