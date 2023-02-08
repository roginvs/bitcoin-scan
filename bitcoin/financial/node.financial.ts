import { createLogger } from "../../logger/logger";
import { createBitcoinBlocksNode } from "../blockchain/blockchain.node";
import { BlockId } from "../node";
import { genesisBlockHash } from "../protocol/consts";
import { BitcoinBlock } from "../protocol/messages.parse";
import { createFinancialStorage } from "./node.financial.storage";
const { info, debug, warn } = createLogger("FINA");

function dumpBuf(buf: Buffer) {
  const str = Buffer.from(buf).reverse().toString("hex");
  return str.slice(0, 8) + "-" + str.slice(-8);
}

export function addFinancial(node: ReturnType<typeof createBitcoinBlocksNode>) {
  const storage = createFinancialStorage();

  function processBlock(block: BitcoinBlock, blockId: BlockId) {
    debug(`Processing block ${dumpBuf(block.hash)} id=${blockId}`);
  }

  let overtakingBlockIndex: BlockId | null;

  const lastProcessedBlockHash = storage.getLastProcessedBlockId();
  if (lastProcessedBlockHash) {
    const blockInfo = node.getSavedBlock(lastProcessedBlockHash);
    if (!blockInfo) {
      throw new Error(
        `Last time we stopped on block ${lastProcessedBlockHash} but no such block in the db now`
      );
    }

    overtakingBlockIndex = blockInfo[1];
    overtakingBlockIndex++;
  } else {
    const genesisInfo = node.getSavedBlock(genesisBlockHash);
    if (genesisInfo) {
      overtakingBlockIndex = genesisInfo[1];
    } else {
      overtakingBlockIndex = null;
    }
  }
  if (overtakingBlockIndex === null) {
    info(`Blockchain do not even have genesis so nothing to overtake`);
  } else {
    while (true) {
      const block = node.getSavedBlock(overtakingBlockIndex)?.[0];
      if (!block || block.transactions.length === 0) {
        break;
      }

      info(`We have unprocessed block index=${overtakingBlockIndex}`);
      processBlock(block, overtakingBlockIndex);

      overtakingBlockIndex++;
    }
    info(`Done with overtake, now ready to accept new blocks`);
  }

  node.onAfterBlockSaved((block, blockId) => {
    processBlock(block, blockId);
  });

  return {
    ...node,
  };
}
