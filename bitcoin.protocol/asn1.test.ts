import {
  asn1parse,
  create_spki_der_from_pubkey,
  packAsn1PairOfIntegers,
  repackSignature,
} from "./asn1";

describe(`Asn tools`, () => {
  for (const b of [
    Buffer.from(""),
    Buffer.from("aabbdd", "hex"),
    Buffer.alloc(35, "a"),
  ]) {
    it(`create_spki_der_from_pubkey ${b.toString("hex")}`, () => {
      const asn1 = create_spki_der_from_pubkey(b);
      const [data, rest] = asn1parse(asn1);
      expect(rest.length).toBe(0);
    });
  }

  it(`Packs 2 integers`, () => {
    const packed = packAsn1PairOfIntegers(
      Buffer.from("03bb", "hex"),
      Buffer.from("ffff", "hex")
    );
    expect(packed.toString("hex")).toBe("3009020203bb020300ffff");
    expect(asn1parse(packed)[1].length).toBe(0);
  });

  it(`Repacks signature`, () => {
    expect(
      repackSignature(Buffer.from("3008020203bb0202ffffabcd", "hex")).toString(
        "hex"
      )
    ).toBe("3009020203bb020300ffffabcd");
  });
});
