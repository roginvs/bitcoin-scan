import Database from "better-sqlite3";

function getDbPath(dbFileName: string) {
  const dataFolder = process.env.SCANNER_STORAGE_DIR;
  if (!dataFolder) {
    throw new Error(`Env variable SCANNER_STORAGE_DIR is not defined`);
  }
  return dataFolder + "/" + dbFileName;
}

export interface SignatureRow {
  compressed_public_key: Buffer;
  msg: Buffer;
  r: Buffer;
  s: Buffer;
}

export function createSignaturesAnalyzerStorage(isMemory = false) {
  const sql = new Database(isMemory ? ":memory:" : getDbPath("/scanner.db"));

  sql.pragma("journal_mode = WAL");
  sql.pragma("auto_vacuum = FULL");
  sql.exec(`

  CREATE TABLE IF NOT EXISTS signatures  (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    compressed_public_key CHARACTER(33) NOT NULL, 
    msg CHARACTER (32) NOT NULL,
    r CHARACTER(32) NOT NULL,
    s CHARACTER(32) NOT NULL
    -- spending_tx_hash CHARACTER(32) NOT NULL,
    -- spending_tx_input_index INTEGER NOT NULL
  );

  -- Having index (compressed_public_key, r) have the same performance
  --  but takes more space
  CREATE INDEX IF NOT EXISTS signature_r ON signatures (r);


  CREATE TABLE IF NOT EXISTS found_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    compressed_public_key CHARACTER(33) NOT NULL, 
    bitcoin_wallet_comp CHARACTER(40), -- Have no idea about hard limit
    bitcoin_wallet_uncomp CHARACTER(40), -- Have no idea about hard limit
    private_key CHARACTER(32) NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS found_keys_pub_key ON found_keys
    (compressed_public_key);
`);

  // Use
  // .mode quote
  // to show values in sqlite console

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
    return getSignaturesSql.all(compressed_public_key, r) as SignatureRow[];
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

  function savePrivateKey(
    compressed_public_key: Buffer,
    walletComp: string,
    walletUncomp: string,
    privateKey: Buffer
  ) {
    sql
      .prepare(
        `
      insert into found_keys (
        compressed_public_key,
        bitcoin_wallet_comp,
        bitcoin_wallet_uncomp,
        private_key
        
      ) values (?, ?, ?, ?)
      `
      )
      .run(compressed_public_key, walletComp, walletUncomp, privateKey);
  }

  return {
    getSignatures,
    saveSignature,
    doWeHavePrivateKeyForThisPubKey,
    savePrivateKey,
  };
}
