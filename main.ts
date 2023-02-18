import "dotenv-defaults/config";

import { createBitcoinNode } from "./bitcoin/node";

const node = createBitcoinNode();

process.on("SIGINT", () => {
  console.info("Received SIGINT, terminating");
  node.stop();
});
