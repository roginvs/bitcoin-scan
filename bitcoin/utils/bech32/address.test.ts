import { PkScript } from "../../protocol/messages.types";
import {
  bitcoinAddressP2WPKHromPublicKey,
  bitcoinAddressP2WSHromPKScript,
  bitcoinAddressP2WSHromPublicKey,
} from "./address";

describe("Testing address encoding", () => {
  // https://bc-2.jp/tools/bech32demo/index.html

  const pubKey = Buffer.from(
    "0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
    "hex"
  );

  it(`p2wpkh`, () => {
    expect(bitcoinAddressP2WPKHromPublicKey(pubKey)).toBe(
      "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
    );
  });

  it(`p2wsh`, () => {
    expect(bitcoinAddressP2WSHromPublicKey(pubKey)).toBe(
      "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3"
    );
  });

  it(`p2wsh 2`, () => {
    expect(
      bitcoinAddressP2WSHromPKScript(
        // This is huge pk_script is last item in tx witness
        Buffer.from(
          "210337b852d288f9f21038bc1aa170372cf7557843e354cbebee0e308e3697735e06ac6476a91406e3c55d036a8e7687f9b834a1b7036b761d410a88ad0396d70bb1672102faff9c96e623c34a6508927de3ba461d7855df6c606d34a8921783c76848da3fad82012088a914887396b4564f3d2f46ae6dd5158244ab4c1bec528768",
          "hex"
        ) as PkScript
      )
    ).toBe("bc1qg95x3ll3caqs65z6tmy9x2xe5y32wnwhygf9n0msv6jjptzuly9snrxtfu");
  });
});
