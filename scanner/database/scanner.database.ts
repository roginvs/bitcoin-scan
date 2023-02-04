import Database from "better-sqlite3";
import {
  PkScript,
  TransactionHash,
} from "../../bitcoin.protocol/messages.types";
import { Nominal } from "../../nominal_types/nominaltypes";

function getDbPath(dbFileName: string) {
  const dataFolder = process.env.SCANNER_STORAGE_DIR;
  if (!dataFolder) {
    throw new Error(`Env variable SCANNER_STORAGE_DIR is not defined`);
  }
  return dataFolder + "/" + dbFileName;
}

export type UnspentTxId = Nominal<"unspent tx id", number>;

export interface TransactionRow {
  compressed_public_key: Buffer;
  msg: Buffer;
  r: Buffer;
  s: Buffer;
  //spending_tx_hash: TransactionHash;
  //spending_tx_input_index: number;
}

export function createTransactionsStorage(isMemory = false) {
  const sql = new Database(isMemory ? ":memory:" : getDbPath("/scanner.db"));

  sql.pragma("journal_mode = WAL");
  sql.pragma("auto_vacuum = FULL");
  sql.exec(`
  CREATE TABLE IF NOT EXISTS unspent_transaction_output  (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    transaction_hash CHARACTER(32) NOT NULL, 
    output_id INTEGER NOT NULL,
    pub_script CHARACTER(32) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS  unspent_hash_out ON unspent_transaction_output
    (transaction_hash, output_id);

  CREATE TABLE IF NOT EXISTS signatures  (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    compressed_public_key CHARACTER(33) NOT NULL, 
    msg CHARACTER (32) NOT NULL,
    r CHARACTER(32) NOT NULL,
    s CHARACTER(32) NOT NULL
    -- spending_tx_hash CHARACTER(32) NOT NULL,
    -- spending_tx_input_index INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS signature_pub_r ON signatures
    (compressed_public_key, r);

  CREATE TABLE IF NOT EXISTS found_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    compressed_public_key CHARACTER(33) NOT NULL, 
    bitcoin_wallet_comp CHARACTER(40), -- Have no idea about hard limit
    bitcoin_wallet_uncomp CHARACTER(40), -- Have no idea about hard limit
    private_key CHARACTER(32) NOT NULL,
    tx_hash_reversed CHARACTER(32) NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS found_keys_pub_key ON found_keys
    (compressed_public_key);
`);

  // Use
  // .mode quote
  // to show values in sqlite console

  const FIX_EXISTING_DUPLICATES = false;
  if (FIX_EXISTING_DUPLICATES) {
    sql.exec(`
          delete from signatures where id in (
           select id from signatures group by compressed_public_key, r,s, msg having count(*) > 1
          );
        `);
  }

  const insertSql = sql.prepare(`insert into unspent_transaction_output 
    (transaction_hash, output_id, pub_script) values (?, ?, ?)`);
  function addUnspentTxOutput(
    hash: TransactionHash,
    output_id: number,
    pubScript: PkScript
  ) {
    insertSql.run(hash, output_id, pubScript);
  }

  const getUnspentSql = sql.prepare(
    `
      select id, pub_script from unspent_transaction_output 
      where transaction_hash = ? and output_id = ?
    `
  );
  function getUnspentOutput(hash: TransactionHash, output_id: number) {
    return getUnspentSql.get(hash, output_id) as
      | { id: UnspentTxId; pub_script: PkScript }
      | undefined;
  }

  const removeUnpendTx = sql.prepare(
    `
       delete from unspent_transaction_output 
      where id = ?
    `
  );
  function removeUnspendTx(id: UnspentTxId) {
    removeUnpendTx.run(id);
  }

  const saveSignatureSql = sql.prepare(`
    insert into signatures (        
        compressed_public_key,
        msg,
        r,
        s
        -- spending_tx_hash,
        -- spending_tx_input_index
      ) values (?, ?, ?, ?)
  `);

  const getSignaturesSql = sql.prepare(`
    select  
      compressed_public_key,
      msg,
      r,
      s
      -- spending_tx_hash,
      -- spending_tx_input_index
    from signatures
    where compressed_public_key = ? and r = ?
 
  `);

  function getSignatures(compressed_public_key: Buffer, r: Buffer) {
    return getSignaturesSql.all(compressed_public_key, r) as TransactionRow[];
  }

  function saveSignature(
    compressed_public_key: Buffer,
    msg: Buffer,
    r: Buffer,
    s: Buffer
  ) {
    saveSignatureSql.run(
      compressed_public_key,
      msg,
      r,
      s
      // spending_tx_hash,
      // spending_tx_input_index
    );
  }

  function doWeHavePrivateKeyForThisPubKey(publicKey: Buffer) {
    return !!sql
      .prepare(`select id from found_keys where compressed_public_key = ?`)
      .get(publicKey);
  }
  /**
   *
   */
  function savePrivateKey(
    compressed_public_key: Buffer,
    walletComp: string,
    walletUncomp: string,
    privateKey: Buffer,
    tx_hash_reversed: Buffer
  ) {
    sql
      .prepare(
        `
      insert into found_keys (
        compressed_public_key,
        bitcoin_wallet_comp,
        bitcoin_wallet_uncomp,
        private_key,
        tx_hash_reversed
      ) values (?, ?, ?, ?, ?)
      `
      )
      .run(
        compressed_public_key,
        walletComp,
        walletUncomp,
        privateKey,
        tx_hash_reversed
      );
  }

  return {
    addUnspentTxOutput,
    getUnspentOutput,
    removeUnspendTx,
    getSignatures,
    saveSignature,
    doWeHavePrivateKeyForThisPubKey,
    savePrivateKey,
  };
}
