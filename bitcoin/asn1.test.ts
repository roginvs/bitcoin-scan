import { asn1parse, create_spki_der_from_pubkey } from "./asn1";

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
});
