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

const keepLastNBlocks = process.env.SCANNER_PRUNE
  ? parseInt(process.env.SCANNER_PRUNE)
  : 0;
if (keepLastNBlocks && keepLastNBlocks > 3) {
  info(`
============================================================================
Scanner will prune processed blocks data keeping only last ${keepLastNBlocks} blocks
============================================================================
`);
  // Scanner will remove it because it have own database for specific txes
  node.onBeforeBlockSaved(() => {
    node.pruneSavedTxes(keepLastNBlocks);
  });
}
