import { createPublicKey, verify } from "crypto";
import {
  create_spki_der_from_pubkey,
  packAsn1PairOfIntegers,
} from "../bitcoin.protocol/asn1";
import { sha256 } from "../bitcoin.protocol/hashes";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { check_signature } from "../my-elliptic-curves/ecdsa";
import { uncompressPublicKey } from "../my-elliptic-curves/uncompressPublicKey";
import { createTransactionsStorage } from "../scanner/database/transactions";
import {
  checkThatThisPrivateKeyForThisPublicKey,
  derivePrivateKeyFromPair,
  SignatureInfo,
} from "./keyDerive";

describe(`Key derive`, () => {
  it(`checkThatThisPrivateKeyForThisPublicKey`, () => {
    const privKey = Buffer.from(
      "8b184d0143d89f76c342cbd9ffa96329ece0e854e6416fd1f58230b90f007ba0",
      "hex"
    );
    const pubKeyExpected = Buffer.from(
      "039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b",
      "hex"
    );
    expect(
      checkThatThisPrivateKeyForThisPublicKey(privKey, pubKeyExpected)
    ).toStrictEqual(true);
  });

  function checkThatSignatureInfoIsCorrect(info: SignatureInfo) {
    const pub = createPublicKey({
      key: create_spki_der_from_pubkey(info.compressed_public_key),
      type: "spki",
      format: "der",
    });

    const verifyResult = verify(
      undefined,
      info.msg,
      pub,
      packAsn1PairOfIntegers(info.r, info.s)
    );
    if (!verifyResult) {
      throw new Error(`Provided data is not valid signature`);
    }

    const myImpVerifyResult = check_signature({
      curve: Secp256k1,
      msgHash: BigInt("0x" + sha256(info.msg).toString("hex")),
      publicKey: uncompressPublicKey(Secp256k1, info.compressed_public_key),
      r: BigInt("0x" + info.r.toString("hex")),
      s: BigInt("0x" + info.s.toString("hex")),
    });
    if (!myImpVerifyResult) {
      throw new Error(`Something wrong with my signatures check!`);
    }
  }
  it(`derivePrivateKeyFromPair`, () => {
    const a = {
      compressed_public_key: Buffer.from(
        "034903acabebcd2185bd64afa44632af51813c4ef25d34b3310d0018271c73f122",
        "hex"
      ),
      msg: Buffer.from(
        "59c05dcca0f8bc539d6276674113030751747d99cc67332f12dd973d2185b4d0",
        "hex"
      ),
      r: Buffer.from(
        "009ac20335eb38768d2052be1dbbc3c8f6178407458e51e6b4ad22f1d91758895b",
        "hex"
      ),
      s: Buffer.from(
        "43273c2390b15bbe7e4d38559b1d4e6c0d63aad2c586652ec423d851df065271",
        "hex"
      ),
    };
    checkThatSignatureInfoIsCorrect(a);
    const b = {
      compressed_public_key: a.compressed_public_key,
      msg: Buffer.from(
        "125546f1e1f27e7c4eb629490b4f7136fb4a587c5248b4ce678e2eff5c7ef3de",
        "hex"
      ),
      r: a.r,
      s: Buffer.from(
        "2da94e7cb83e17d307d46c80df4f3315b17af13c4a04ef352495f1442562a290",
        "hex"
      ),
    };
    checkThatSignatureInfoIsCorrect(b);

    const derived = derivePrivateKeyFromPair(a, b);
    expect(derived.compressed_public_key.toString("hex")).toBe(
      a.compressed_public_key.toString("hex")
    );
  });
});
