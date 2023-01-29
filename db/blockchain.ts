import Database from "better-sqlite3";
import { genesisBlockHash } from "../bitcoin/consts";
import { BlockHash } from "../bitcoin/messages.types";

export function createBlockchainStorage(isMemory = false) {
  const blockchain = new Database(isMemory ? ":memory:" : "blockchain.db");

  blockchain.pragma("journal_mode = WAL");
  blockchain.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    hash CHARACTER(32) NOT NULL, 
    processed BOOLEAN NOT NULL DEFAULT FALSE
  );
`);

  function pushNewBlockHash(hash: BlockHash) {
    blockchain.prepare(`INSERT INTO blocks (hash) VALUES (?)`).run(hash);
  }

  const firstBlock = blockchain
    .prepare("SELECT * FROM blocks WHERE id = 1")
    .get();
  if (!firstBlock) {
    console.info("Creating data for the first block");
    pushNewBlockHash(genesisBlockHash);
  }

  function getLastKnownBlocks(n = 10) {
    const blocks = blockchain
      .prepare(`select id, hash from blocks order by id desc limit ?`)
      .all(n)
      .map((b) => ({ id: b.id as number, hash: b.hash as BlockHash }));
    return blocks;
  }

  function pushNewKnownBlock(hash: BlockHash) {
    // TODO: Accept block itself and check that it actually points to the previous block
    pushNewBlockHash(hash);
  }

  function getNextUprocessedBlocks(n = 10) {
    const blocks = blockchain
      .prepare(
        `select id, hash from blocks where not processed order by id limit ?`
      )
      .all(n)
      .map((b) => ({ id: b.id as number, hash: b.hash as BlockHash }));

    return blocks;
  }

  function markBlockAsProccessed(id: number) {
    blockchain
      .prepare(`update blocks set processed = true where id = ?`)
      .run(id);
  }

  return {
    getLastKnownBlocks,
    pushNewKnownBlock,
    getNextUprocessedBlocks,
    markBlockAsProccessed,
  };
}
