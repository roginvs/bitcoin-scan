import { createPublicKey, verify } from "crypto";
import {
  create_spki_der_from_pubkey,
  packAsn1PairOfIntegers,
} from "../bitcoin.protocol/asn1";
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

  it(`Example keys`, () => {
    const storage = createTransactionsStorage(true);

    const data = [
      [
        Buffer.from(
          "039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b",
          "hex"
        ),
        Buffer.from(
          "785c979cc3e829ea5f1468c919e0115188694ecc2b78f21185ba2392cd54fbb3",
          "hex"
        ),
        Buffer.from(
          "00fb1299738dc025ca0e2fdc140879513458b2e6bdc03a692fef4299ddfd359ef7",
          "hex"
        ),
        Buffer.from(
          "0097af3747a2a4d04ab3dc0a1f101d258c4634cc49e4c29f5305e13780f7ec862d",
          "hex"
        ),
      ],
      [
        Buffer.from(
          "039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b",
          "hex"
        ),
        Buffer.from(
          "479e96f439b55df6db68b79bcf10ce99e19c245b23034644b10f46a2f5ed90b7",
          "hex"
        ),
        Buffer.from(
          "00fb1299738dc025ca0e2fdc140879513458b2e6bdc03a692fef4299ddfd359ef7",
          "hex"
        ),
        Buffer.from(
          "0096e3e090fc4ba12ec875caae59dc4bbeb8a39ff7ba9b2313b0452f07da3a455c",
          "hex"
        ),
      ],
      [
        Buffer.from(
          "039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b",
          "hex"
        ),
        Buffer.from(
          "a26d58a7b14eb645a21619c816280ff6ad2914e7a913e929f280392766184fc7",
          "hex"
        ),
        Buffer.from(
          "00fb1299738dc025ca0e2fdc140879513458b2e6bdc03a692fef4299ddfd359ef7",
          "hex"
        ),
        Buffer.from(
          "43686dde312001dbeee43709c1a7cb019e18734bbb6fea9b72ec8980ed60656b",
          "hex"
        ),
      ],
    ] as const;
    let pubKeys = 0;
    for (const [pubKey, msg, r, s] of data) {
      const stats = storage.saveSignatureDetails(pubKey, msg, r, s, "lol");
      if (stats) {
        pubKeys += 1;
      }
    }
    expect(pubKeys).toStrictEqual(1);
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
    console.info(`verifyResult=${verifyResult}`);
    if (!verifyResult) {
      throw new Error("LOL KEK");
    }
  }
  it.only(`derivePrivateKeyFromPair`, () => {
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
