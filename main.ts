import "dotenv-defaults/config";

import { createBitcoinNode } from "./bitcoin/node";

const node = createBitcoinNode();

process.on("SIGINT", () => {
  console.info("Received SIGINT, terminating");
  node.stop();
});

node.onMempoolTx((tx) => {
  console.info(`NEW MEMPOOL TX ${tx.txid.toString("hex")}`);
  console.info(`Total mempool length = ${node.getAllMempoolTxes().length}`);
});
