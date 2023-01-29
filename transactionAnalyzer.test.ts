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
  it(`Recovers private key`, () => {
    /*
    Those are spending txes (in Buffer order):
      4d70dc463c4ca1cafdb40c57d58b2b5fdcade4675289a78c7fd67e2086199e25
      b491171b8a31e5e2bcfb87bb3561a820df0b312eb5e133b1118dca9bf7fbed19
    The same in web order
      259e1986207ed67f8ca7895267e4addc5f2b8bd5570cb4fdcaa14c3c46dc704d
      19edfbf79bca8d11b133e1b52e310bdf20a86135bb87fbbce2e5318a1b1791b4

      Blocks are (in web order)
      121487 0000000000004b340fa8c1e8f392cd294ce809abde7fbb23da76a6e18dd0f2df
      121481 000000000000036ebb190c689fd284c49929e0ead03a01b07c5c7ed95b1a1742

    Origin txes and their blocks (in web order)
      259e1986207ed67f8ca7895267e4addc5f2b8bd5570cb4fdcaa14c3c46dc704d
        121481
      ceac8bd01e72ada6c3c03aed17c9d20a422dc7f09501e306c74610fe593bfb8a
      ceac8bd01e72ada6c3c03aed17c9d20a422dc7f09501e306c74610fe593bfb8a
        121333 00000000000022474e654ec4ebd6cd665a3602d6cd5ddb34c91039d152974fec
      9197b170e4b8b2aa438d122a2ffe99a3e138cc682532cefecbc34803209aca5f
        121343 0000000000005a8bb3f60dafac542328a83d930d0fd6811e77758189022230bb
    */
  });
});
