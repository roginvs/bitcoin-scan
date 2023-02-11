import Database from "better-sqlite3";
import {
  BlockHash,
  PkScript,
  TransactionHash,
} from "../../bitcoin/protocol/messages.types";
import { Nominal } from "../../nominal_types/nominaltypes";
import { getDbPath } from "../config";

export interface UnspentTxRow {
  transaction_hash: TransactionHash;
  output_id: number;
  pub_script: PkScript;
  value: BigInt;
}
export interface AddBlockDataParams {
  unspentTxesToRemove: [txid: TransactionHash, out_number: number][];
  addNewUnspentTxes: UnspentTxRow[];
  blockId: BlockHash;
}
export function createFinancialStorage(isMemory = false) {
  const sql = new Database(isMemory ? ":memory:" : getDbPath("financial.db"));

  sql.pragma("journal_mode = WAL");
  sql.pragma("auto_vacuum = FULL");
  sql.exec(`
    CREATE TABLE IF NOT EXISTS unspent_transaction_outputs  (
      id INTEGER PRIMARY KEY, 
      transaction_hash CHARACTER(32) NOT NULL, 
      output_id INTEGER NOT NULL,
      pub_script BLOB NOT NULL,
      value integer
    );

    CREATE INDEX IF NOT EXISTS unspent_tx_out_idx ON unspent_transaction_outputs
     (transaction_hash, output_id);

    -- To get value per each wallet
    CREATE INDEX IF NOT EXISTS unspent_pub_script_idx ON unspent_transaction_outputs
     (pub_script);


    -- Just a way to remember which block we processed last time
    CREATE TABLE IF NOT EXISTS last_processed_block_hash (
        _uniq INTEGER NOT NULL CHECK (_uniq = 1),
        block_hash CHARACTER(32) NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS last_processed_block_hash_idx ON last_processed_block_hash
     (_uniq);
`);

  const removeUnspendTxSql = sql.prepare(
    "delete from unspent_transaction_outputs where transaction_hash = ? and output_id = ?"
  );
  const addNewUnspentTxSql = sql.prepare(
    `insert into unspent_transaction_outputs 
    (transaction_hash, output_id, pub_script, value) values (?,?,?,?)`
  );
  const removeLastProcessedBlock = sql.prepare(
    `delete from last_processed_block_hash; `
  );
  const addLastProcessedBlockHashSql = sql.prepare(
    `insert into last_processed_block_hash (_uniq, block_hash) values (1, ?) `
  );

  function addBlockData(params: AddBlockDataParams) {
    sql.transaction<(data: AddBlockDataParams) => void>((data) => {
      data.unspentTxesToRemove.forEach(([txid, output_id]) =>
        removeUnspendTxSql.run(txid, output_id)
      );
      data.addNewUnspentTxes.forEach((row) =>
        addNewUnspentTxSql.run(
          row.transaction_hash,
          row.output_id,
          row.pub_script,
          row.value
        )
      );
      removeLastProcessedBlock.run();
      addLastProcessedBlockHashSql.run(data.blockId);
    })(params);
  }

  const getUnspentTxSql = sql.prepare(`
     select transaction_hash, output_id, pub_script, value from
     unspent_transaction_outputs where transaction_hash = ? and output_id = ?
  `);
  function getUnspentTx(txid: TransactionHash, output_id: number) {
    return getUnspentTxSql.get(txid, output_id) as UnspentTxRow | undefined;
  }

  function getLastProcessedBlockId() {
    return sql.prepare("select block_hash from last_processed_block_hash").get()
      ?.block_hash as BlockHash | undefined;
  }

  return {
    addBlockData,
    getUnspentTx,
    getLastProcessedBlockId,
    close: () => sql.close(),
  };
}
