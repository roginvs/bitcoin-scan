import "dotenv-defaults/config";
import { Block } from "typescript";
import { createBitcoinNode } from "../bitcoin.node/node";
import { BlockId } from "../bitcoin.node/node.storage";
import { BitcoinBlock } from "../bitcoin.protocol/messages.parse";
import { createAnalyzer } from "./transactionAnalyzer";

const analyzer = createAnalyzer();
console.info("Analyzer created");

const node = createBitcoinNode([
  [
    process.argv[2] || "95.216.21.47",
    process.argv[3] ? parseInt(process.argv[3]) : 8333,
  ],
  // Some other nodes
  ["95.216.47.4", 8333],
  ["95.216.76.224", 8333],
]);

function processBlock(block: BitcoinBlock, currentHeight: number) {
  const blockInformation = Buffer.from(block.hash).reverse().toString("hex");
  console.info(`Processing block ${blockInformation} h=${currentHeight}`);
  let savedOutputsCount = 0;
  let savedSignatures = 0;
  let keysFound = 0;
  for (const tx of block.transactions) {
    const stats = analyzer.transaction(tx, blockInformation);
    savedOutputsCount += stats.savedOutputsCount;
    savedSignatures += stats.savedSignatures;
    keysFound += stats.keysFound;
  }
  console.info(
    `  tx=${block.transactions.length} savedOutputsCount=${savedOutputsCount} savedSignatures=${savedSignatures}`
  );
  if (keysFound > 0) {
    console.info(`FOUND NEW KEYS`);
  }
}

const RESCAN_EVERYTHING_FROM_THE_BEGINNING = false;
if (RESCAN_EVERYTHING_FROM_THE_BEGINNING) {
  let i = 1;
  while (true) {
    const block = node.getSavedBlock(i as BlockId);
    if (!block) {
      break;
    }
    processBlock(block, i - 1);

    i++;
  }
}

node.onNewDownloadedBlock(processBlock);

const pruning = process.env.SCANNER_PRUNE
  ? parseInt("process.env.SCANNER_PRUNE")
  : 0;
if (pruning && pruning > 3) {
  console.info(`
========================================
Scanner will prune processed blocks data
========================================
`);
  // Scanner will remove it because it have own database for specific txes
  node.onNewDownloadedBlock(() => {
    node.pruneSavedTxes(pruning);
  });
}
