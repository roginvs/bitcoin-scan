import { Secp256k1 } from "./curves.named";
import { uncompressPublicKey } from "./uncompressPublicKey";

describe(`uncompressPublicKey`, () => {
  it(`Already uncompressed`, () => {
    const uncompressed = Buffer.from(
      "04 79BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798 483ADA77 26A3C465 5DA4FBFC 0E1108A8 FD17B448 A6855419 9C47D08F FB10D4B8".replace(
        / /g,
        ""
      ),
      "hex"
    );

    expect(uncompressPublicKey(Secp256k1, uncompressed)).toStrictEqual(
      Secp256k1.G
    );
  });
});
