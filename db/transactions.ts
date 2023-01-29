import Database from "better-sqlite3";
import { PkScript, TransactionHash } from "../bitcoin/messages.types";
import { derivePrivateKeyFromPair } from "../keyDerive";
import { Nominal } from "../nominal_types/nominaltypes";

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
  const sql = new Database(
    isMemory ? ":memory:" : __dirname + "/transactions.db"
  );

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
    bitcoin_wallet CHARACTER(40), -- Have no idea about hard limit
    private_key CHARACTER(32) NOT NULL,
    info TEXT NOT NULL
  )
`);

  // Use
  // .mode quote
  // to show values in sqlite console

  const FIX_EXISTING_DUPLICATES = true;
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

  const saveSignatureDetailsSql = sql.prepare(`
    insert into signatures (        
        compressed_public_key,
        msg,
        r,
        s
        -- spending_tx_hash,
        -- spending_tx_input_index
      ) values (?, ?, ?, ?)
  `);

  const checkDuplicatesSql = sql.prepare(`
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

  function saveSignatureDetails(
    compressed_public_key: Buffer,
    msg: Buffer,
    r: Buffer,
    s: Buffer,
    blockInformation: string
    //spending_tx_hash: TransactionHash,
    //spending_tx_input_index: number
  ) {
    const sameValues = checkDuplicatesSql.all(
      compressed_public_key,
      r
    ) as TransactionRow[];
    if (sameValues.some((valuesInDb) => valuesInDb.s.equals(s))) {
      // Ok, we already have data with such compressed_public_key,r,s
      return false;
    }

    const dataToDeriveKey = [
      ...sameValues,
      {
        compressed_public_key,
        msg,
        r,
        s,
        //spending_tx_hash,
        //spending_tx_input_index,
      },
    ];
    const isNewKeyDerived = derivePrivateKey(dataToDeriveKey, blockInformation);

    saveSignatureDetailsSql.run(
      compressed_public_key,
      msg,
      r,
      s
      // spending_tx_hash,
      // spending_tx_input_index
    );
    return isNewKeyDerived;
  }

  const isThisPubKeyAlreadyThereSql = sql.prepare(
    `select id from found_keys where compressed_public_key = ?`
  );
  const insertNewKey = sql.prepare(`
  insert into found_keys (
    compressed_public_key,
    bitcoin_wallet,
    private_key,
    info
  ) values (?, ?, ?, ?)
`);
  function derivePrivateKey(data: TransactionRow[], blockInfo: string) {
    let foundKey = false;
    for (let i = 0; i < data.length - 1; i++) {
      if (isThisPubKeyAlreadyThereSql.get(data[i].compressed_public_key)) {
        continue;
      }
      for (let j = i + 1; j < data.length; j++) {
        if (isThisPubKeyAlreadyThereSql.get(data[j].compressed_public_key)) {
          continue;
        }

        const key = derivePrivateKeyFromPair(data[i], data[j]);
        insertNewKey.run(
          key.compressed_public_key,
          key.walletString,
          key.privateKeyBuf,
          blockInfo
        );
        foundKey = true;
      }
    }
    return foundKey;
  }

  return {
    addUnspentTxOutput,
    getUnspentOutput,
    removeUnspendTx,
    saveSignatureDetails,
  };
}
