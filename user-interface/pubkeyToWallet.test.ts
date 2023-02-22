import { pubkeyToWallet } from "./pubkeyToWallet";

describe("pubkeyToWallet", () => {
  const myPubkeyHex = {
    x: "9b095a4bf6b07821aea4e17faa67d23ab67651b0e560278554ae44f6074eb52c",
    y: "1ff0ba6dd6933e9b57da2e2ac154c42db20d103d91c21f6933b5d7cd11c0d334",
  };
  const testData = [
    [myPubkeyHex, "P2PKH compressed", "19aJFYXVr9wjEm3cfQnJDHW2oyNEY2soWR"],
    [myPubkeyHex, "P2PKH uncompressed", "1MFjZqSy86daBdQhzqNwmJhpcnpZ9CgdGZ"],
    [
      {
        x: "f118cc409775419a931c57664d0c19c405e856ac0ee2f0e2a4137d8250531128",
        y: "b8de75aed0aa32305e3e184f2ecba6d50208560464b7cc4e8c02ebcd8bf569e6",
      },
      "Segwit P2SH",
      "3Mwz6cg8Fz81B7ukexK8u8EVAW2yymgWNd",
    ],
    [
      // https://www.blockchain.com/explorer/transactions/btc/2536df79439801c8daecde247d156f02b78d3a080d85e5e1615260fc4f273f1f
      {
        x: "b59eaa6923744ab2357f8b3772187d42bd318d2706a1faabc7b2444e16354871",
        y: "d79eab3276fb53f3445b7d3fb2bd21f8e53ab7df5e3b165ddbf859f7d0d34c23",
      },
      "Segwit Bech32",
      "bc1q42lja79elem0anu8q8s3h2n687re9jax556pcc",
    ],
  ] as const;

  for (const [pubkeyHex, walletType, wallet] of testData) {
    it(`${walletType} = ${wallet}`, () =>
      expect(pubkeyToWallet(pubkeyHex, walletType)).toBe(wallet));
  }
});
