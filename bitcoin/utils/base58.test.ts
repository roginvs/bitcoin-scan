import { base58decode, base58encode, bitcoinAddressFromP2PKH } from "./base58";

const testData = {
  "0000030405": "1121kY",
  "009C13ABEAA29473787191861F62952F651CE6EDAC3D6CC5B3":
    "1FEFyjGTFbc128EXz298mRd2PsPGhobkWe",
};
describe(`base58encode`, () => {
  for (const [input, output] of Object.entries(testData)) {
    it(`Encodes ${input} into ${output}`, () =>
      expect(base58encode(Buffer.from(input, "hex"))).toBe(output));
  }
});
describe(`base58decode`, () => {
  for (const [output, input] of Object.entries(testData)) {
    it(`Decodes ${input} into ${output}`, () =>
      expect(base58decode(input).toString("hex").toUpperCase()).toBe(output));
  }
});
describe(`Encode address`, () => {
  const testData = {
    "9c13abeaa29473787191861f62952f651ce6edac":
      "1FEFyjGTFbc128EXz298mRd2PsPGhobkWe",
  };
  for (const [input, output] of Object.entries(testData)) {
    const pubkeyHash = Buffer.from(input, "hex");
    it(`Public key ${input} is ${output}`, () => {
      expect(bitcoinAddressFromP2PKH(pubkeyHash)).toBe(output);
    });
  }
});
