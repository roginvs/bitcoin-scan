import "dotenv-defaults/config";
import { createBitcoinNode, BlockId } from "../bitcoin/node";
import { BitcoinBlock } from "../bitcoin/protocol/messages.parse";
import { createLogger } from "../logger/logger";
import { createSignaturesAnalyzer } from "./signaturesAnalyzer";
const { info, warn, debug } = createLogger("SCANNER");

const analyzer = createSignaturesAnalyzer();
debug("Analyzer created");

const node = createBitcoinNode();

node.onValidatedSignature((sigInfo) => analyzer.ecdsaSignature(sigInfo));
node.onAfterBlockSaved(() => {
  info(
    `signaturesSaved=${analyzer.signaturesSaved} keysFound=${analyzer.keysFound}`
  );
});

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
