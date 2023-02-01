import Database from "better-sqlite3";
import {
  BlockHash,
  BlockPayload,
  TransactionHash,
  TransactionPayload,
} from "../bitcoin.protocol/messages.types";
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
      block_numeric_id INTEGER,      
      txid CHARACTER(32) NOT NULL,      
      transaction_index_in_block INTEGER NOT NULL,
      data BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transaction_hash ON block_transactions (txid);
    CREATE INDEX IF NOT EXISTS transaction_block_id ON block_transactions (block_numeric_id);    
    -- CREATE INDEX IF NOT EXISTS transaction_block_id ON block_transactions (block_id, block_index);
  `);

  function getLastKnownBlocksHashes(n = 10): BlockHash[] {
    const blockHashes = sql
      .prepare(`select hash from headerschain order by id desc limit ?`)
      .all(n)
      .map((row) => row.hash);

    return blockHashes;
  }

  function pushNewBlockHeader(hash: BlockHash, blockHeader: Buffer) {
    if (blockHeader.length !== 80) {
      throw new Error(`We expect block header here!`);
    }
    sql
      .prepare(
        `
      insert into headerschain (hash, header) values (?, ?)
    `
      )
      .run(hash, blockHeader);
  }

  function pruneLastNBlocksData(n: number) {
    // TODO
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
            select id from headerschain order by id desc limit 1`
      )
      .get()?.id as BlockId | undefined;
    return dbId;
  }

  const insertIntoBlockTransactionsSql = sql.prepare(`    
    insert into block_transactions (
      block_numeric_id,
      txid,
      transaction_index_in_block,
      data
    ) values (?, ?, ?, ?)
  `);
  const saveBlockTransactions = sql.transaction<
    (
      blockHash: BlockHash,
      txes: { txid: TransactionHash; payload: TransactionPayload }[]
    ) => void
  >((blockHash, txes) => {
    const blockNumericId = sql
      .prepare(`select id from headerschain where hash = ?`)
      .get(blockHash)?.id;
    if (!blockNumericId) {
      throw new Error(`No such block in the saved transactions`);
    }
    for (const [index, tx] of txes.entries()) {
      insertIntoBlockTransactionsSql.run(
        blockNumericId,
        tx.txid,
        index,
        tx.payload
      );
    }
  });

  function getBlockIdsWithoutTransactions(n = 10) {
    return sql
      .prepare(
        `
      select id, hash from headerschain where id > (
      select ifnull(max(block_numeric_id),0) from block_transactions
      ) order by id limit ?;
    `
      )
      .all(n)
      .map((row) => ({ id: row.id as BlockId, hash: row.hash as BlockHash }));
  }

  function getBlockHeader(hash: BlockHash): BlockPayload {
    return sql
      .prepare(
        `
      select header from headerschain where hash = ?
    `
      )
      .get(hash).header;
  }
  function getBlockTransactions(hash: BlockHash): TransactionPayload[] {
    return sql
      .prepare(
        `
        select data from block_transactions 
        where block_numeric_id = 
          (select id from headerschain where hash = ?)
        order by transaction_index_in_block

      
      `
      )
      .all(hash)
      .map((row) => row.data);
  }

  return {
    getLastKnownBlocksHashes,
    pushNewBlockHeader,
    pruneLastNBlocksData,
    getLastKnownBlockId,
    getBlockIdsWithoutTransactions,
    saveBlockTransactions,
    getBlockHeader,
    getBlockTransactions,
  };
}
