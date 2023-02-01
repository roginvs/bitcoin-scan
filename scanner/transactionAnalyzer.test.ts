import { createPrivateKey, createPublicKey, generateKeyPairSync } from "crypto";
import { asn1parse } from "../bitcoin.protocol/asn1";
import { compressPublicKey } from "../bitcoin.protocol/compressPublicKey";
import { ripemd160, sha256 } from "../bitcoin.protocol/hashes";
import { packTx } from "../bitcoin.protocol/messages.create";
import { BitcoinTransaction, readTx } from "../bitcoin.protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionHash,
} from "../bitcoin.protocol/messages.types";
import { isSourceScriptP2PKH } from "../bitcoin.protocol/script";
import { sourceTxRaw, spendingTxRaw } from "../bitcoin.protocol/testdata";
import { joinBuffers } from "../bitcoin.protocol/utils";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { signature } from "../my-elliptic-curves/ecdsa";
import { createAnalyzer } from "./transactionAnalyzer";

describe("createAnalyzer", () => {
  it(`Pushing data`, () => {
    const analyzer = createAnalyzer(true);
    {
      const sourceTx = readTx(sourceTxRaw)[0];
      const stats1 = analyzer.transaction(sourceTx, "some info");
      expect(stats1.savedOutputsCount).toBe(1);
      expect(stats1.savedSignatures).toBe(0);
    }
    {
      const spendingTx = readTx(spendingTxRaw)[0];
      const stats2 = analyzer.transaction(spendingTx, "some info");
      expect(stats2.savedOutputsCount).toBe(1);
      expect(stats2.savedSignatures).toBe(1);
    }
  });

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
        txid: Buffer.alloc(0) as TransactionHash,
        lockTime: 0,
        version: 1,
        txIn: [
          {
            outpointHash: Buffer.alloc(32).fill(0) as TransactionHash,
            outpointIndex: 0,
            script: Buffer.alloc(0) as SignatureScript,
            sequence: 1,
            witness: undefined,
          },
        ],
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

    const statsIn = analyzer.transaction(txOut, "some infoo");
    expect(statsIn.savedOutputsCount).toBe(2);

    for (const outpointIndex of [0, 1]) {
      const txInForSig = packTx({
        // This will be updated after packing and unpacking
        txid: Buffer.alloc(0) as TransactionHash,
        lockTime: 0,
        version: 1,
        txIn: [
          {
            outpointHash: txOut.txid,
            outpointIndex,
            script: pkScript as Buffer as SignatureScript,
            sequence: 0xffffffff,
            witness: undefined,
          },
        ],
        txOut: [],
      });
      const sig1Msg = sha256(
        joinBuffers(
          txInForSig,
          // hashTypeCode
          Buffer.from("01000000", "hex")
        )
      );

      const k = BigInt("0x31231412412312333");
      const sig = signature({
        curve: Secp256k1,
        msgHash: BigInt("0x" + sha256(sig1Msg).toString("hex")),
        k,
        privateKey: BigInt("0x" + privateKeyBuf.toString("hex")),
      });

      function bigintToBuf(n: BigInt) {
        let s = n.toString(16);
        if (s.length % 2 != 0) {
          s = "0" + s;
        }
        return Buffer.from(s, "hex");
      }
      function packIntForAsn(b: Buffer) {
        if (b[0] & 0b10000000) {
          return joinBuffers(Buffer.from([0]), b);
        } else {
          return b;
        }
      }
      const r = packIntForAsn(bigintToBuf(sig.r));
      const s = packIntForAsn(bigintToBuf(sig.s));
      const signatureAndHashType = joinBuffers(
        Buffer.from([0x30, r.length + s.length + 2 + 2]),
        Buffer.from([0x02, r.length]),
        r,
        Buffer.from([0x02, s.length]),
        s,
        Buffer.from([1])
      );
      expect(asn1parse(signatureAndHashType)[1].length).toBe(1);

      const script = joinBuffers(
        Buffer.from([signatureAndHashType.length]),
        signatureAndHashType,
        Buffer.from([myPublicKeyCompressed.length]),
        myPublicKeyCompressed
      ) as SignatureScript;
      const txIn = {
        // This will be updated after packing and unpacking
        txid: Buffer.alloc(0) as TransactionHash,
        lockTime: 0,
        version: 1,
        txIn: [
          {
            outpointHash: txOut.txid,
            outpointIndex,
            script,
            sequence: 0xffffffff,
            witness: undefined,
          },
        ],
        txOut: [],
      };

      const stats = analyzer.transaction(txIn, "some info");
      expect(stats.savedSignatures).toBe(1);
      if (outpointIndex === 1) {
        expect(stats.keysFound).toBe(1);
      }
    }
  });

  /*
  it(`Recovers private key`, () => {
    
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
    
  });
  */
});
