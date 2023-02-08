import { createLogger } from "../../logger/logger";
import { createBitcoinBlocksNode } from "../blockchain/blockchain.node";
import { BlockId } from "../node";
import { genesisBlockHash } from "../protocol/consts";
import { BitcoinBlock } from "../protocol/messages.parse";
import {
  AddBlockDataParams,
  createFinancialStorage,
} from "./node.financial.storage";
import { validateScript } from "./validateScript";
const { info, debug, warn } = createLogger("FINA");

function dumpBuf(buf: Buffer) {
  const str = Buffer.from(buf).reverse().toString("hex");
  return str.slice(0, 8) + "-" + str.slice(-8);
}

export function addFinancial(node: ReturnType<typeof createBitcoinBlocksNode>) {
  const storage = createFinancialStorage();

  function processBlock(block: BitcoinBlock, blockId: BlockId) {
    debug(`Processing block ${dumpBuf(block.hash)} id=${blockId}`);

    const data: AddBlockDataParams = {
      unspentTxesToRemove: [],
      addNewUnspentTxes: [],
      blockId: block.hash,
    };
    for (const [txIndex, tx] of block.transactions.entries()) {
      debug(`  Processing transaction ${dumpBuf(tx.txid)}`);

      if (txIndex === 0) {
        if (tx.txIn.length != 1) {
          throw new Error(`First tx must have exactly one input`);
        }
        if (!tx.txIn[0].outpointHash.equals(Buffer.alloc(32, 0))) {
          throw new Error(`First tx must have all zeros in outpoint hash`);
        }
        if (tx.txIn[0].outpointIndex !== 0xffffffff) {
          throw new Error(`First tx must have all 1 in outpoint index`);
        }
      }
      const isCoinbase = txIndex === 0;

      if (!isCoinbase) {
        for (const [txInIndex, txIn] of tx.txIn.entries()) {
          let inputForThisTx = storage.getUnspentTx(
            txIn.outpointHash,
            txIn.outpointIndex
          );
          if (!inputForThisTx) {
            // Hmm, maybe we are spending transaction from this block?
            const thisBlockInIdx = data.addNewUnspentTxes.findIndex(
              (v) =>
                v.transaction_hash.equals(txIn.outpointHash) &&
                v.output_id === txIn.outpointIndex
            );
            if (thisBlockInIdx > -1) {
              debug("  Wow, find unspent output in the same block!");
              inputForThisTx = data.addNewUnspentTxes[thisBlockInIdx];
              data.addNewUnspentTxes.splice(thisBlockInIdx, 1);
            } else {
              warn(`  tx=${Buffer.from(tx.txid).reverse().toString("hex")}`);
              warn(`  txInIndex = ${txInIndex}`);
              throw new Error(`Outpoint is not found in unspent!`);
            }
          }

          validateScript(inputForThisTx.pub_script, tx, txInIndex);

          data.unspentTxesToRemove.push([
            inputForThisTx.transaction_hash,
            inputForThisTx.output_id,
          ]);
        }
      }

      for (const [txOutIndex, txOut] of tx.txOut.entries()) {
        data.addNewUnspentTxes.push({
          transaction_hash: tx.txid,
          output_id: txOutIndex,
          pub_script: txOut.script,
          value: txOut.value,
        });
      }
    }
    storage.addBlockData(data);
    debug(`  processed`);
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
