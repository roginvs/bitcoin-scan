describe("Testing address encoding", () => {
  const pubKey = Buffer.from(
    "0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
    "hex"
  );

  // TODO

  // P2WPKH bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4
  // P2WSH bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3

  // https://bc-2.jp/tools/bech32demo/index.html
  // WitnessScript:(<pubkey> OP_CHECKSIG[0xac])
});
