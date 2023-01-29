import Database from "better-sqlite3";
import { createPrivateKey, createPublicKey } from "crypto";
import { bitcoinAddressFromP2PKH } from "../bitcoin/base58";
import { compressPublicKey } from "../bitcoin/compressPublicKey";
import { genesisBlockHash } from "../bitcoin/consts";
import { ripemd160, sha256 } from "../bitcoin/hashes";
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

  function derivePrivateKey(data: TransactionRow[], blockInfo: string) {
    let foundKey = false;
    for (let i = 0; i < data.length - 1; i++) {
      for (let j = i + 1; j < data.length; j++) {
        foundKey ||= derivePrivateKeyFromPair(data[i], data[j], blockInfo);
      }
    }
    return foundKey;
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
  function derivePrivateKeyFromPair(
    a: TransactionRow,
    b: TransactionRow,
    blockInfo: string
  ) {
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

    if (isThisPubKeyAlreadyThereSql.get(a.compressed_public_key)) {
      return false;
    }

    const privateKeyBigInt = get_private_key_if_diff_k_is_known(
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

    let privateKeyStr = privateKeyBigInt.toString(16);
    if (privateKeyStr.length % 2 !== 0) {
      privateKeyStr = "0" + privateKeyStr;
    }
    const privateKeyBuf = Buffer.from(privateKeyStr, "hex");

    if (
      !checkThatThisPrivateKeyForThisPublicKey(
        privateKeyBuf,
        a.compressed_public_key
      )
    ) {
      console.warn(`LOL WHAT, why my key is not recovered?`);
      return false;
    }

    const walletString = bitcoinAddressFromP2PKH(
      ripemd160(sha256(a.compressed_public_key))
    );
    insertNewKey.run(
      a.compressed_public_key,
      walletString,
      privateKeyBuf,
      blockInfo
    );

    return true;
  }

  return {
    addUnspentTxOutput,
    getUnspentOutput,
    removeUnspendTx,
    saveSignatureDetails,
  };
}

export function checkThatThisPrivateKeyForThisPublicKey(
  privateKey: Buffer,
  publicKeyExpected: Buffer
) {
  const privKeySec1 = Buffer.from(
    "30540201010400" +
      privateKey.toString("hex") +
      "a00706052b8104000aa14403420004190c32f1461a9c34b6a5b9c1ff363612fe1ff88e1b25903af208845aac75d4b9487faf59547b429c7152074cc17d9cc2a9c9781a33acfbf3d0c97795b0a24662",
    "hex"
  );
  const diff = privateKey.length;
  privKeySec1[1] += diff;
  privKeySec1[6] += diff;

  const myPrivKey = createPrivateKey({
    key: privKeySec1,
    format: "der",
    type: "sec1",
  });
  const myPublicKey = createPublicKey(myPrivKey);
  const myPublicKeyUncompressed = myPublicKey
    .export({ format: "der", type: "spki" })
    .subarray(20 + 2 + 1, 20 + 2 + 1 + 66);
  const myPublicKeyCompressed = compressPublicKey(myPublicKeyUncompressed)!;
  return publicKeyExpected.equals(myPublicKeyCompressed);
}
