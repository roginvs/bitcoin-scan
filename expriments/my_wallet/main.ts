import "dotenv-defaults/config";
import { createBitcoinBlocksNode } from "../../bitcoin/blockchain/blockchain.node";
import { createTransaction } from "./createTx";
import { createLOLTransaction } from "./createTxFromLol";

const demoTx = createTransaction();

function startNode() {
  const node = createBitcoinBlocksNode();

  process.on("SIGINT", () => {
    console.info("Received SIGINT, terminating");
    node.stop();
  });
  node.addTxToMempool(demoTx.parsed);
}

// startNode();
