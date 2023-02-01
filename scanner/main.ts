import { createBitcoinNode } from "../bitcoin.node/node";
import { createAnalyzer } from "./transactionAnalyzer";

const analyzer = createAnalyzer();
console.info("Analyzer created");

const node = createBitcoinNode([
  ["95.216.21.47", 8333],
  ["95.216.47.4", 8333],
  ["95.216.76.224", 8333],
]);

node.onNewValidatedBlock((block, currentHeight) => {
  const blockInformation = Buffer.from(block.hash).reverse().toString("hex");
  console.info(`Processing block ${blockInformation}`);
  let savedOutputsCount = 0;
  let savedSignatures = 0;
  let keysFound = 0;
  for (const tx of block.transactions) {
    const stats = analyzer.transaction(tx, blockInformation);
    savedOutputsCount += stats.savedOutputsCount;
    savedSignatures += stats.savedSignatures;
    keysFound += stats.keysFound;
  }
});

// Scanner will remove it because it have own database for specific txes
const keepBlocks = 3;
node.onNewValidatedBlock(() => {
  node.pruneSavedTxes(keepBlocks);
});
