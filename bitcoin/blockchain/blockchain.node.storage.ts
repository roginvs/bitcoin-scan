import Database from "better-sqlite3";
import {
  BlockHash,
  BlockHeaderPayload,
  BlockPayload,
  TransactionHash,
  TransactionPayload,
} from "../protocol/messages.types";
import { Nominal } from "../../nominal_types/nominaltypes";
import { getDbPath } from "../config";

export type BlockDbId = Nominal<"block numeric id", number>;

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
      id INTEGER PRIMARY KEY, 
      block_numeric_id INTEGER,      
      txid CHARACTER(32) NOT NULL,      
      transaction_index_in_block INTEGER NOT NULL,
      data BLOB NOT NULL
    );
    -- Kind of no reason to keep it
    DROP INDEX IF EXISTS transaction_hash;    
    
    CREATE INDEX IF NOT EXISTS transaction_block_id ON block_transactions (block_numeric_id);    
    -- CREATE INDEX IF NOT EXISTS transaction_block_id ON block_transactions (block_id, block_index);



    CREATE TABLE IF NOT EXISTS mempool_transactions (
      id INTEGER PRIMARY KEY,
      txid CHARACTER(32) NOT NULL,      
      payload BLOB NOT NULL,
      fee integer not null,
      created_at integer not null
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mempool_transactions_txid ON mempool_transactions (txid);
    CREATE INDEX IF NOT EXISTS mempool_transactions_created_at ON mempool_transactions (created_at);
    CREATE INDEX IF NOT EXISTS mempool_transactions_fee ON mempool_transactions (fee);
  `);

  function getLastKnownBlocksHashes(n = 10): BlockHash[] {
    const blockHashes = sql
      .prepare(`select hash from headerschain order by id desc limit ?`)
      .all(n)
      .map((row) => row.hash);

    return blockHashes;
  }

  function pushNewBlockHeader(
    hash: BlockHash,
    blockHeader: BlockHeaderPayload
  ) {
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

  function pruneSavedTxes(n: number) {
    // Not sure that sub-query is optimal but let it be so
    sql
      .prepare(
        `
          delete from block_transactions where block_numeric_id <=
        (select block_numeric_id from block_transactions 
          group by block_numeric_id 
          order by block_numeric_id desc limit 1 offset ?)
        `
      )
      .run(n);
  }

  function getLastKnownBlockId() {
    const dbId = sql
      .prepare(
        `
            select id from headerschain order by id desc limit 1`
      )
      .get()?.id as BlockDbId | undefined;
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

  function getBlockWithoutTransactionsInfo(
    limitAmount: number,
    minId: BlockDbId
  ) {
    return sql
      .prepare(
        `
      select id, hash from headerschain where id > (
        select ifnull(max(block_numeric_id),0) from block_transactions
      ) and id >= ? order by id limit ?
    `
      )
      .all(minId, limitAmount)
      .map((row) => ({ id: row.id as BlockDbId, hash: row.hash as BlockHash }));
  }

  function getBlocksHeaders(
    startingId: BlockDbId,
    limit: number
  ): BlockHeaderPayload[] {
    return sql
      .prepare(
        `select header from headerschain where id > ? order by id limit ?`
      )
      .all(startingId, limit)
      .map((row) => row.header);
  }
  function getBlockHeader(hashOrId: BlockHash | BlockDbId):
    | {
        id: BlockDbId;
        hash: BlockHash;
        header: BlockHeaderPayload;
      }
    | undefined {
    return sql
      .prepare(
        typeof hashOrId === "number"
          ? `select id, hash, header from headerschain where id = ?`
          : `select id, hash, header from headerschain where hash = ?`
      )
      .get(hashOrId);
  }
  function getBlockTransactions(blockId: BlockDbId): TransactionPayload[] {
    return sql
      .prepare(
        `
        select data from block_transactions 
        where block_numeric_id = ?
        order by transaction_index_in_block

      
      `
      )
      .all(blockId)
      .map((row) => row.data);
  }

  const addMempoolTransactionSql = sql.prepare(
    `insert or ignore into mempool_transactions 
      (txid, payload, fee, created_at) values (?, ?, ?, STRFTIME('%s'));
    `
  );
  function addMempoolTransaction(
    txid: TransactionHash,
    payload: TransactionPayload,
    fee: number
  ) {
    addMempoolTransactionSql.run(txid, payload, fee);
  }
  function getAllMempoolTransactionIds() {
    return sql.prepare(`select txid from mempool_transactions`).all() as {
      txid: TransactionHash;
    }[];
  }
  function pruneMempoolTransactions(
    txids: TransactionHash[],
    expiredThresholdHours = 24 * 5
  ) {
    const removeTxById = sql.prepare(
      `delete from mempool_transactions where txid = ?`
    );
    txids.forEach((txid) => removeTxById.run(txid));
    sql
      .prepare(
        `
      delete from mempool_transactions where created_at < STRFTIME('%s') - ?
    `
      )
      .run(expiredThresholdHours * 60 * 60);
  }
  const isMempoolTxExistsSql = sql.prepare(
    "select count(*) as count from mempool_transactions where txid = ?"
  );
  function isMempoolTxExists(txid: TransactionHash) {
    return isMempoolTxExistsSql.get(txid).count > 0;
  }

  const getMempoolTxSql = sql.prepare(
    "select txid, payload from mempool_transactions where txid = ?"
  );
  function getMempoolTx(txid: TransactionHash) {
    return getMempoolTxSql.get(txid) as {
      txid: TransactionHash;
      payload: TransactionPayload;
    };
  }

  return {
    getLastKnownBlocksHashes,
    pushNewBlockHeader,
    getLastKnownBlockDbId: getLastKnownBlockId,
    pruneSavedTxes,
    getBlockWithoutTransactionsInfo,
    saveBlockTransactions,
    getBlockHeader,
    getBlocksHeaders,
    getBlockTransactions,
    addMempoolTransaction,
    getAllMempoolTransactionIds,
    pruneMempoolTransactions,
    isMempoolTxExists,
    getMempoolTx,
    close: () => sql.close(),
  };
}
