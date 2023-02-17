import "dotenv-defaults/config";
import { createBitcoinBlocksNode } from "../../bitcoin/blockchain/blockchain.node";
import { createTransaction } from "./createTx";

const node = createBitcoinBlocksNode();

process.on("SIGINT", () => {
  console.info("Received SIGINT, terminating");
  node.stop();
});

const demoTx = createTransaction();
console.info(
  `Transaction id = ${Buffer.from(demoTx.parsed.txid)
    .reverse()
    .toString("hex")}`
);
console.info(demoTx.parsed);
node.addTxToMempool(demoTx.parsed);
