import "dotenv-defaults/config";

import { createBitcoinNode } from "./bitcoin.node/node";

const node = createBitcoinNode([["95.216.21.47", 8333]]);
