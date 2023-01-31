import { genesisBlockHash } from "../../bitcoin.protocol/consts";
import { BlockHash } from "../../bitcoin.protocol/messages.types";
import { createBlockchainStorage } from "./blockchain";

describe("Blockchain database", () => {
  it(`Not crashes and returns valid data`, () => {
    const db = createBlockchainStorage(true);
    const knownBlocks = db.getLastKnownBlocks();
    expect(knownBlocks.length).toBe(1);
    expect(knownBlocks[0].id).toBe(1);
    expect(knownBlocks[0].hash.toString("hex")).toBe(
      genesisBlockHash.toString("hex")
    );

    for (const x of ["a", "b", "c", "d", "e"]) {
      const newBlock = Buffer.alloc(32, x) as BlockHash;
      db.pushNewKnownBlock(newBlock);
    }

    expect(db.getLastKnownBlocks(3).length).toBe(3);
    expect(db.getLastKnownBlocks(3)[0].hash.toString("latin1")).toBe(
      "e".repeat(32)
    );

    const unprocessed = db.getNextUprocessedBlocks(1);
    expect(unprocessed[0].hash.toString("hex")).toBe(
      genesisBlockHash.toString("hex")
    );

    db.markBlockAsProccessed(unprocessed[0].id);

    const unprocessed2 = db.getNextUprocessedBlocks(1);
    expect(unprocessed2[0].hash.toString("latin1")).toBe("a".repeat(32));
  });
});
