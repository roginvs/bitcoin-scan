import "dotenv-defaults/config";

import { createBitcoinNode } from "./bitcoin/node";

const node = createBitcoinNode();

process.on("SIGINT", () => {
  console.info("Received SIGINT, terminating");
  node.stop();
});

node.onMempoolTx((tx) => {
  console.info(
    `New mempool ${Buffer.from(tx.txid).reverse().toString("hex")} ` +
      `Total mempool length = ${node.getAllMempoolTxes().length}`
  );
});
