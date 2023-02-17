import "dotenv-defaults/config";
import { createBitcoinBlocksNode } from "../../bitcoin/blockchain/blockchain.node";

const node = createBitcoinBlocksNode();

process.on("SIGINT", () => {
  console.info("Received SIGINT, terminating");
  node.stop();
});
