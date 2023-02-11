import { createPrivateKey, createPublicKey, generateKeyPairSync } from "crypto";
import {
  asn1parse,
  packAsn1PairOfIntegers,
  packIntForAsn,
} from "../bitcoin/script/asn1";
import { compressPublicKey } from "../bitcoin/protocol/compressPublicKey";
import { ripemd160, sha256 } from "../bitcoin/utils/hashes";
import { packTx } from "../bitcoin/protocol/messages.create";
import { BitcoinTransaction, readTx } from "../bitcoin/protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionHash,
  TransactionPayload,
} from "../bitcoin/protocol/messages.types";
import { isSourceScriptP2PKH } from "../bitcoin/script/p2pkh";
import { sourceTxRaw, spendingTxRaw } from "../bitcoin/protocol/testdata";
import { joinBuffers } from "../bitcoin/utils/joinBuffer";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { signature } from "../my-elliptic-curves/ecdsa";
import { createSignaturesAnalyzer } from "./signaturesAnalyzer";
import { modulo_power_point } from "../my-elliptic-curves/curves";

function bigintToBuf(n: BigInt, len: number = 32) {
  let s = n.toString(16);
  if (s.length % 2 != 0) {
    s = "0" + s;
  }
  if (s.length / 2 > len) {
    throw new Error(`Length is too small`);
  }
  const prefix = "0".repeat(len * 2 - s.length);
  s = prefix + s;
  if (s.length !== len * 2) {
    throw new Error(`Internal error`);
  }
  return Buffer.from(s, "hex");
}

describe(`Signatures analyzer`, () => {
  const myPrivKeyBuf = Buffer.from("Aaabbbbccccddd332123", "hex");
  const myPrivKeyBigInt = BigInt("0x" + myPrivKeyBuf.toString("hex"));
  const publicKeyPoint = modulo_power_point(
    Secp256k1.G,
    myPrivKeyBigInt,
    Secp256k1.a,
    Secp256k1.p
  );
  const myPublicKeyCompressed = compressPublicKey(
    joinBuffers(
      Buffer.from([0x04]),
      bigintToBuf(publicKeyPoint![0]),
      bigintToBuf(publicKeyPoint![1])
    )
  );
  if (!myPublicKeyCompressed) {
    throw new Error(`Failed to compress public key`);
  }

  const k = BigInt("0x31231412412312333");

  const msg1 = Buffer.from("this is some message blablabla");
  const sig1 = signature({
    curve: Secp256k1,
    msgHash: BigInt("0x" + sha256(msg1).toString("hex")),
    k,
    privateKey: BigInt("0x" + myPrivKeyBuf.toString("hex")),
  });

  const msg2 = Buffer.from("this is some other message blablabla");
  const sig2 = signature({
    curve: Secp256k1,
    msgHash: BigInt("0x" + sha256(msg2).toString("hex")),
    k,
    privateKey: BigInt("0x" + myPrivKeyBuf.toString("hex")),
  });

  it(`Saves signatures and derives private key`, () => {
    const scanner = createSignaturesAnalyzer(true);

    expect(scanner.keysFound).toBe(0);
    expect(scanner.signaturesSaved).toBe(0);

    for (const iteration of [1, 2]) {
      scanner.ecdsaSignature({
        msg: msg1,
        pubKeyCompressed: myPublicKeyCompressed,
        r: bigintToBuf(sig1.r),
        s: bigintToBuf(sig1.s),
      });

      expect(scanner.keysFound).toBe(0);
      expect(scanner.signaturesSaved).toBe(1);
    }

    scanner.ecdsaSignature({
      msg: msg2,
      pubKeyCompressed: myPublicKeyCompressed,
      r: bigintToBuf(sig2.r),
      s: bigintToBuf(sig2.s),
    });

    expect(scanner.keysFound).toBe(1);
    expect(scanner.signaturesSaved).toBe(2);
  });
});
