import "dotenv-defaults/config";

import { createBitcoinNode } from "./bitcoin.node/node";

// seed.bitcoin.sipa.be:8333
const node = createBitcoinNode([
  ["95.216.21.47", 8333],
  ["95.216.47.4", 8333],
  ["95.216.76.224", 8333],
]);
