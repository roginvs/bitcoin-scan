import { createLogger } from "../../logger/logger";
import { createBitcoinNode } from "../blockchain/blockchain.node";
import { BlockId } from "../node";
import { BitcoinBlock } from "../protocol/messages.parse";
import { ECDSASignatureValidatedListener } from "../script/types";
import { buildSubscriber } from "../subscriber";
import {
  AddBlockDataParams,
  createFinancialStorage,
} from "./node.financial.storage";
import { validateScript } from "./validateScript";
const { info, debug, warn } = createLogger("FINANCE");

function dumpBuf(buf: Buffer) {
  const str = Buffer.from(buf).reverse().toString("hex");
  return str.slice(0, 8) + "-" + str.slice(-8);
}

export function addFinancial(node: ReturnType<typeof createBitcoinNode>) {
  const storage = createFinancialStorage();

  const onValidatedSignature: ECDSASignatureValidatedListener[] = [];

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

          validateScript(
            inputForThisTx.pub_script,
            tx,
            txInIndex,
            (sigData) => {
              onValidatedSignature.forEach((f) => f(sigData));
            }
          );

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
  node.onAfterBlockSaved((block, blockId) => {
    processBlock(block, blockId);
  });

  node.catchUpBlocks(storage.getLastProcessedBlockId(), processBlock);

  node.onStop(() => {
    info(`Terminating financial`);
    storage.close();
  });
  return {
    onValidatedSignature: buildSubscriber(onValidatedSignature),
  };
}
