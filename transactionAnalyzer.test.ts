import { createPrivateKey, createPublicKey, generateKeyPairSync } from "crypto";
import { compressPublicKey } from "./bitcoin/compressPublicKey";
import { ripemd160, sha256 } from "./bitcoin/hashes";
import { packTx } from "./bitcoin/messages.create";
import { BitcoinTransaction, readTx } from "./bitcoin/messages.parse";
import { PkScript, TransactionHash } from "./bitcoin/messages.types";
import { isSourceScriptP2PKH } from "./bitcoin/script";
import { sourceTxRaw, spendingTxRaw } from "./bitcoin/testdata";
import { joinBuffers } from "./bitcoin/utils";
import { createAnalyzer } from "./transactionAnalyzer";

describe("createAnalyzer", () => {
  it(`Pushing data`, () => {
    const analyzer = createAnalyzer(true);
    {
      const sourceTx = readTx(sourceTxRaw)[0];
      const stats1 = analyzer.transaction(sourceTx);
      expect(stats1.savedOutputsCount).toBe(1);
      expect(stats1.savedSignatures).toBe(0);
    }
    {
      const spendingTx = readTx(spendingTxRaw)[0];
      const stats2 = analyzer.transaction(spendingTx);
      expect(stats2.savedOutputsCount).toBe(1);
      expect(stats2.savedSignatures).toBe(1);
    }
  });

  /*
  it(`Catches duplicate r`, () => {
    const privKeySec1 = Buffer.from(
      "MHQCAQEEIB8g6XfObz3nqZLyJn449IlRAeFaKBX62uU8SOWwE5E5oAcGBSuBBAAKoUQDQgAEGQwy8UYanDS2pbnB/zY2Ev4f+I4bJZA68giEWqx11LlIf69ZVHtCnHFSB0zBfZzCqcl4GjOs+/PQyXeVsKJGYg==",
      "base64"
    );
    // Offsets are asn1 just hardcoded
    const privateKeyBuf = privKeySec1.subarray(5 + 2, 5 + 2 + 32);

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
    const myPublicKeyHash = ripemd160(sha256(myPublicKeyCompressed));
    const pkScript = joinBuffers(
      Buffer.from("76a914", "hex"),
      myPublicKeyHash,
      Buffer.from("88ac", "hex")
    ) as PkScript;
    expect(typeof isSourceScriptP2PKH(pkScript)).not.toBe("string");

    const txOut = readTx(
      packTx({
        // This will be updated after packing and unpacking
        hash: Buffer.alloc(0) as TransactionHash,
        lockTime: 0,
        version: 1,
        txIn: [],
        txOut: [
          {
            script: pkScript,
            value: BigInt(10),
          },
          {
            script: pkScript,
            value: BigInt(20),
          },
        ],
      })
    )[0];

    const analyzer = createAnalyzer(true);

    analyzer.transaction(txOut);

    const txInForSig = readTx(
      packTx({
        // This will be updated after packing and unpacking
        hash: Buffer.alloc(0) as TransactionHash,
        lockTime: 0,
        version: 1,
        txIn: [{}],
        txOut: [],
      })
    )[0];
  });
  */
});
