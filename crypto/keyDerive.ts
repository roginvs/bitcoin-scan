import { createPrivateKey, createPublicKey } from "crypto";
import { bitcoinAddressFromP2PKH } from "../bitcoin.protocol/base58";
import { compressPublicKey } from "../bitcoin.protocol/compressPublicKey";
import { ripemd160, sha256 } from "../bitcoin.protocol/hashes";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { get_private_key_if_k_is_the_same } from "../my-elliptic-curves/ecdsa";

export interface SignatureInfo {
  compressed_public_key: Buffer;
  msg: Buffer;
  r: Buffer;
  s: Buffer;
}
export function derivePrivateKeyFromPair(a: SignatureInfo, b: SignatureInfo) {
  if (!a.compressed_public_key.equals(b.compressed_public_key)) {
    throw new Error(`Internal error, this should never happen`);
  }
  if (!a.r.equals(b.r)) {
    throw new Error(`Internal error, this should never happen`);
  }
  if (a.s.equals(b.s)) {
    throw new Error(`Internal error, this should never happen`);
  }
  if (a.msg.equals(b.msg)) {
    throw new Error(`Internal error, this should never happen`);
  }

  const privateKeyBigInt = get_private_key_if_k_is_the_same(
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
    BigInt("0x" + sha256(b.msg).toString("hex"))
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
    throw new Error(`Internal error, LOL WHAT, why my key is not recovered`);
  }

  const walletString = bitcoinAddressFromP2PKH(
    ripemd160(sha256(a.compressed_public_key))
  );
  return {
    compressed_public_key: a.compressed_public_key,
    walletString,
    privateKeyBuf,
  };
}

export function checkThatThisPrivateKeyForThisPublicKey(
  privateKey: Buffer,
  publicKeyExpected: Buffer
) {
  const privKeySec1 = Buffer.from(
    "300E0201010400" + privateKey.toString("hex") + "a00706052b8104000a",
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
