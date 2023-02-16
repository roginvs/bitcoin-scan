import {
  bitcoinAddressFromP2PKH,
  bitcoinAddressP2PKHFromPublicKey,
} from "./adresses";

describe(`Encode address`, () => {
  const testData = {
    "9c13abeaa29473787191861f62952f651ce6edac":
      "1FEFyjGTFbc128EXz298mRd2PsPGhobkWe",
  };
  for (const [input, output] of Object.entries(testData)) {
    const pubkeyHash = Buffer.from(input, "hex");
    it(`Public key hash ${input} is ${output}`, () => {
      expect(bitcoinAddressFromP2PKH(pubkeyHash)).toBe(output);
    });
  }

  it(`Pubkey 039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b`, () =>
    expect(
      bitcoinAddressP2PKHFromPublicKey(
        Buffer.from(
          "039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b",
          "hex"
        )
      )
    ).toBe("177xexbFtmNC5naj6uieHi5ppQ5umXduZm"));
});
