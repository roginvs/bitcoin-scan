import { createBitcoinBlocksNode } from "./blockchain/blockchain.node";
import { addFinancial } from "./financial/node.financial";
export { BlockDbId as BlockId } from "./blockchain/blockchain.node.storage";

export function createBitcoinNode() {
  const node = createBitcoinBlocksNode();
  return addFinancial(node);
}
