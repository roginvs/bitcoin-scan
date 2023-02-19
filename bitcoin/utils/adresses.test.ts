import { PkScript } from "../protocol/messages.types";
import {
  bitcoin_address_P2SH_from_script_hash,
  bitcoin_address_P2PKH_from_pubkey_hash,
  bitcoin_address_P2PKH_from_public_key,
  bitcoin_address_P2SH_from_pk_script,
} from "./adresses";

describe(`Encode address`, () => {
  const testData = {
    "9c13abeaa29473787191861f62952f651ce6edac":
      "1FEFyjGTFbc128EXz298mRd2PsPGhobkWe",
  };
  for (const [input, output] of Object.entries(testData)) {
    const pubkeyHash = Buffer.from(input, "hex");
    it(`Public key hash ${input} is ${output}`, () => {
      expect(bitcoin_address_P2PKH_from_pubkey_hash(pubkeyHash)).toBe(output);
    });
  }

  it(`Pubkey 039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b`, () =>
    expect(
      bitcoin_address_P2PKH_from_public_key(
        Buffer.from(
          "039ba39856eec011b79f1acb997760ed9d3f90d477077d17df2571d94b2fa2137b",
          "hex"
        )
      )
    ).toBe("177xexbFtmNC5naj6uieHi5ppQ5umXduZm"));

  it(`Script hash 4266fc6f2c2861d7fe229b279a79803afca7ba34`, () =>
    expect(
      bitcoin_address_P2SH_from_script_hash(
        Buffer.from("4266fc6f2c2861d7fe229b279a79803afca7ba34", "hex")
      )
    ).toBe("37k7toV1Nv4DfmQbmZ8KuZDQCYK9x5KpzP"));

  it(`Script itself`, () =>
    expect(
      bitcoin_address_P2SH_from_pk_script(
        Buffer.from("6e879169a77ca787", "hex") as PkScript
      )
    ).toBe("37k7toV1Nv4DfmQbmZ8KuZDQCYK9x5KpzP"));
});
