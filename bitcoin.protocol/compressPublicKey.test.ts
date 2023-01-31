import { compressPublicKey } from "./compressPublicKey";

describe("compressPublicKey", () => {
  it(`Uncompressed1`, () => {
    const Uncompressed1 = Buffer.from(
      "04 79BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798 483ADA77 26A3C465 5DA4FBFC 0E1108A8 FD17B448 A6855419 9C47D08F FB10D4B8".replace(
        / /g,
        ""
      ),
      "hex"
    );
    expect(compressPublicKey(Uncompressed1)?.toString("hex")).toStrictEqual(
      "0279BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798"
        .toLowerCase()
        .replace(/ /g, "")
    );
  });
  it(`Uncompressed 2`, () => {
    expect(
      compressPublicKey(
        Buffer.from(
          `04` +
            `18ed2e1ec629e2d3dae7be1103d4f911c24e0c80e70038f5eb5548245c475f50` +
            `4c220d01e1ca419cb1ba4b3393b615e99dd20aa6bf071078f70fd949008e7411"`,
          "hex"
        )
      )?.toString("hex")
    ).toStrictEqual(
      "0318ed2e1ec629e2d3dae7be1103d4f911c24e0c80e70038f5eb5548245c475f50"
    );
  });

  it(`Already compressed`, () => {
    expect(
      compressPublicKey(
        Buffer.from(
          `03` +
            `18ed2e1ec629e2d3dae7be1103d4f911c24e0c80e70038f5eb5548245c475f50`,
          "hex"
        )
      )?.toString("hex")
    ).toStrictEqual(
      "0318ed2e1ec629e2d3dae7be1103d4f911c24e0c80e70038f5eb5548245c475f50"
    );
  });
});
