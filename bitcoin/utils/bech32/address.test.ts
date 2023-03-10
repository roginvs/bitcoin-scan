import { PkScript } from "../../protocol/messages.types";
import {
  bitcoin_address_P2WPKH_from_public_key,
  bitcoin_address_P2WSH_from_pk_script,
  bitcoin_address_P2WSH_from_public_key,
  get_P2WSH_pk_script_from_real_pk_script,
} from "./address";

describe("Testing address encoding", () => {
  // https://bc-2.jp/tools/bech32demo/index.html

  const pubKey = Buffer.from(
    "0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
    "hex"
  );

  it(`p2wpkh`, () => {
    expect(bitcoin_address_P2WPKH_from_public_key(pubKey)).toBe(
      "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
    );
  });

  it(`p2wsh`, () => {
    expect(bitcoin_address_P2WSH_from_public_key(pubKey)).toBe(
      "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3"
    );
  });

  const demoPkScriptFromLatestItemInWitness = Buffer.from(
    "210337b852d288f9f21038bc1aa170372cf7557843e354cbebee0e308e3697735e06ac6476a91406e3c55d036a8e7687f9b834a1b7036b761d410a88ad0396d70bb1672102faff9c96e623c34a6508927de3ba461d7855df6c606d34a8921783c76848da3fad82012088a914887396b4564f3d2f46ae6dd5158244ab4c1bec528768",
    "hex"
  ) as PkScript;
  it(`bitcoinAddressP2WSHromPKScript`, () => {
    expect(
      bitcoin_address_P2WSH_from_pk_script(demoPkScriptFromLatestItemInWitness)
    ).toBe("bc1qg95x3ll3caqs65z6tmy9x2xe5y32wnwhygf9n0msv6jjptzuly9snrxtfu");
  });

  it(`getP2WSHpkscriptFromRealPkScript`, () => {
    expect(
      get_P2WSH_pk_script_from_real_pk_script(
        demoPkScriptFromLatestItemInWitness
      ).toString("hex")
    ).toBe(
      "0020416868fff1c7410d505a5ec85328d9a122a74dd7221259bf7066a520ac5cf90b"
    );
  });
});
