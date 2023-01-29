import { createTransactionsStorage } from "./db/transactions";
import { checkThatThisPrivateKeyForThisPublicKey } from "./keyDerive";

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
});
