import { parseSignatureHeader } from "./parseSignatureHeader";

describe(`parseSignatureHeader`, () => {
  it(`Value 0x1f`, () =>
    expect(parseSignatureHeader(0x1f)).toStrictEqual({
      recId: 0,
      walletType: "P2PKH compressed",
    }));

  it(`Value 0x20`, () =>
    expect(parseSignatureHeader(0x20)).toStrictEqual({
      recId: 1,
      walletType: "P2PKH compressed",
    }));
});
