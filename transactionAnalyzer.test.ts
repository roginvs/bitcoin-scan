import { readTx } from "./bitcoin/messages.parse";
import { sourceTxRaw, spendingTxRaw } from "./bitcoin/testdata";
import { createAnalyzer } from "./transactionAnalyzer";

describe("createAnalyzer", () => {
  it(`Pushing data`, () => {
    const analyzer = createAnalyzer(true);
    {
      const sourceTx = readTx(sourceTxRaw)[0];
      const stats1 = analyzer.transaction(sourceTx);
      expect(stats1.savedOutputsCount).toBe(1);
      expect(stats1.savedSignatures).toBe(0);
    }
    {
      const spendingTx = readTx(spendingTxRaw)[0];
      const stats2 = analyzer.transaction(spendingTx);
      expect(stats2.savedOutputsCount).toBe(1);
      expect(stats2.savedSignatures).toBe(1);
    }
  });
});
