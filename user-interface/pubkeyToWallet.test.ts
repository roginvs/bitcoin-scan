import { pubkeyToWallet } from "./pubkeyToWallet";

describe("pubkeyToWallet", () => {
  const pubKeyHex = {
    x: "9b095a4bf6b07821aea4e17faa67d23ab67651b0e560278554ae44f6074eb52c",
    y: "1ff0ba6dd6933e9b57da2e2ac154c42db20d103d91c21f6933b5d7cd11c0d334",
  };
  const testData = [
    ["P2PKH compressed", "19aJFYXVr9wjEm3cfQnJDHW2oyNEY2soWR"],
  ] as const;

  for (const [walletType, wallet] of testData) {
    it(`${walletType} = ${wallet}`, () =>
      expect(pubkeyToWallet(pubKeyHex, walletType)).toBe(wallet));
  }
});
