import "dotenv-defaults/config";

import { createBitcoinNode } from "./bitcoin/node";

const node = createBitcoinNode();

// Problem: this is called only for new blocks
node.onValidatedSignature((sigInfo) => {
  console.info(`Validated signature`, sigInfo);
  process.exit(0);
});
