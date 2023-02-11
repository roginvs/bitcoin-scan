import "dotenv-defaults/config";
import { createBitcoinNode, BlockId } from "../bitcoin/node";
import { BitcoinBlock } from "../bitcoin/protocol/messages.parse";
import { createLogger } from "../logger/logger";
import { createAnalyzer } from "./signaturesAnalyzer";
const { info, warn, debug } = createLogger("SCANNER");

const analyzer = createAnalyzer();
debug("Analyzer created");

const node = createBitcoinNode();

let totalKeysFound = 0;
function processBlock(block: BitcoinBlock, currentHeight: number) {
  const started = new Date();
  const blockInformation = Buffer.from(block.hash).reverse().toString("hex");
  let savedOutputsCount = 0;
  let savedSignatures = 0;
  let keysFound = 0;
  for (const tx of block.transactions) {
    const stats = analyzer.transaction(tx, blockInformation);
    savedOutputsCount += stats.savedOutputsCount;
    savedSignatures += stats.savedSignatures;
    keysFound += stats.keysFound;
  }
  totalKeysFound += keysFound;
  info(
    `block=...${blockInformation.slice(-8)} height=${currentHeight} ` +
      `tx_count=${block.transactions.length} savedOutputsCount=${savedOutputsCount} ` +
      `savedSignatures=${savedSignatures} ` +
      `took ${new Date().getTime() - started.getTime()}ms, ` +
      `keysFound=${keysFound} totalKeysFound=${totalKeysFound}`
  );

  if (keysFound > 0) {
    warn(`FOUND NEW KEYS`);
  }
}

const RESCAN_EVERYTHING_FROM_THE_BEGINNING = false;
if (RESCAN_EVERYTHING_FROM_THE_BEGINNING) {
  let i = 1;
  while (true) {
    const block = node.getSavedBlock(i as BlockId)?.[0];
    if (!block) {
      break;
    }
    if (block.transactions.length === 0) {
      break;
    }
    processBlock(block, i - 1);

    i++;
  }
}

node.onBeforeBlockSaved(processBlock);

const pruning = process.env.SCANNER_PRUNE
  ? parseInt("process.env.SCANNER_PRUNE")
  : 0;
if (pruning && pruning > 3) {
  info(`
========================================
Scanner will prune processed blocks data
========================================
`);
  // Scanner will remove it because it have own database for specific txes
  node.onBeforeBlockSaved(() => {
    node.pruneSavedTxes(pruning);
  });
}
