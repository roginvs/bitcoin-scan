import {
  bitcoinAddressP2WPKHromPublicKey,
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
});
