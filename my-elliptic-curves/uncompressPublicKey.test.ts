import { Secp256k1 } from "./curves.named";
import { uncompressPublicKey } from "./uncompressPublicKey";

describe(`uncompressPublicKey`, () => {
  it(`Already uncompressed`, () => {
    const alreadyUncompressed = Buffer.from(
      "04 79BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798 483ADA77 26A3C465 5DA4FBFC 0E1108A8 FD17B448 A6855419 9C47D08F FB10D4B8".replace(
        / /g,
        ""
      ),
      "hex"
    );

    expect(uncompressPublicKey(Secp256k1, alreadyUncompressed)).toStrictEqual(
      Secp256k1.G
    );
  });
  it(`Compresed with 0x02`, () => {
    expect(
      uncompressPublicKey(
        Secp256k1,
        Buffer.from(
          "0252972572d465d016d4c501887b8df303eee3ed602c056b1eb09260dfa0da0ab2",
          "hex"
        )
      )
    ).toStrictEqual([
      BigInt(
        "0x52972572d465d016d4c501887b8df303eee3ed602c056b1eb09260dfa0da0ab2"
      ),
      BigInt(
        "0x88742f4dc97d9edb6fd946babc002fdfb06f26caf117b9405ed79275763fdb1c"
      ),
    ]);
  });

  it(`Compresed with 0x03`, () => {
    expect(
      uncompressPublicKey(
        Secp256k1,
        Buffer.from(
          "0318ed2e1ec629e2d3dae7be1103d4f911c24e0c80e70038f5eb5548245c475f50",
          "hex"
        )
      )
    ).toStrictEqual([
      BigInt(
        "0x18ed2e1ec629e2d3dae7be1103d4f911c24e0c80e70038f5eb5548245c475f50"
      ),
      BigInt(
        "0x4c220d01e1ca419cb1ba4b3393b615e99dd20aa6bf071078f70fd949008e7411"
      ),
    ]);
  });
});
