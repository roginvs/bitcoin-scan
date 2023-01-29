import Database from "better-sqlite3";
import { genesisBlockHash } from "../bitcoin/consts";
import { sha256 } from "../bitcoin/hashes";
import {
  BlockHash,
  PkScript,
  TransactionHash,
} from "../bitcoin/messages.types";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { get_private_key_if_diff_k_is_known } from "../my-elliptic-curves/ecdsa";
import { Nominal } from "../nominal_types/nominaltypes";

export type UnspentTxId = Nominal<"unspent tx id", number>;

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

  interface TransactionRow {
    compressed_public_key: Buffer;
    msg: Buffer;
    r: Buffer;
    s: Buffer;
    //spending_tx_hash: TransactionHash;
    //spending_tx_input_index: number;
  }

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
    const isNewKeyDerived = derivePrivateKey(dataToDeriveKey);

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

  function derivePrivateKey(data: TransactionRow[]) {
    let foundKey = false;
    for (let i = 0; i < data.length - 1; i++) {
      for (let j = i + 1; j < data.length; j++) {
        foundKey ||= derivePrivateKeyFromPair(data[i], data[j]);
      }
    }
    return foundKey;
  }
  function derivePrivateKeyFromPair(a: TransactionRow, b: TransactionRow) {
    if (!a.compressed_public_key.equals(b.compressed_public_key)) {
      console.warn(`How this can happen?`);
      return false;
    }
    if (!a.r.equals(b.r)) {
      console.warn(`How this can happen?`);
      return false;
    }
    if (a.s.equals(b.s)) {
      console.warn(`Same s, this should not be provided?`);
      return false;
    }
    if (a.msg.equals(b.msg)) {
      console.warn(`Same msg, this should not be provided?`);
      return false;
    }

    // TODO: Check that we do not have such private key
    const privateKey = get_private_key_if_diff_k_is_known(
      Secp256k1,
      {
        r: BigInt("0x" + a.r.toString("hex")),
        s: BigInt("0x" + a.s.toString("hex")),
      },
      BigInt("0x" + sha256(a.msg).toString("hex")),
      {
        r: BigInt("0x" + b.r.toString("hex")),
        s: BigInt("0x" + b.s.toString("hex")),
      },
      BigInt("0x" + sha256(b.msg).toString("hex")),
      BigInt(0)
    );
    // Save it to the database

    return false;
  }

  return {
    addUnspentTxOutput,
    getUnspentOutput,
    removeUnspendTx,
    saveSignatureDetails,
  };
}
