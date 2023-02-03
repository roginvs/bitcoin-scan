import { compressPublicKey } from "../bitcoin.protocol/compressPublicKey";
import { packTx } from "../bitcoin.protocol/messages.create";
import { BitcoinTransaction } from "../bitcoin.protocol/messages.parse";
import {
  check_P2PKH_SIGHASH_ALL,
  isSignatureScriptLooksLikeP2PKH,
  isSourceScriptP2PKH,
  VERIFICATION_FAILED_RESULT,
} from "../bitcoin.protocol/script";
import { createTransactionsStorage } from "./database/transactions";
import { createLogger } from "../logger/logger";
const { info, warn, debug } = createLogger("SCANNER");

export function createAnalyzer(isMemory: boolean = false) {
  const storage = createTransactionsStorage(isMemory);

  function transaction(tx: BitcoinTransaction, blockInformation: string) {
    let savedOutputsCount = 0;
    for (const [index, outTx] of tx.txOut.entries()) {
      const pubKeyHash = isSourceScriptP2PKH(outTx.script);
      if (typeof pubKeyHash === "string") {
        debug(`out ${index} not a P2PKH: ${pubKeyHash}`);
        continue;
      }
      debug(`out ${index} added to unspent`);
      storage.addUnspentTxOutput(tx.txid, index, outTx.script);
      savedOutputsCount++;
    }

    let savedSignatures = 0;
    let keysFound = 0;
    for (const [index, inTx] of tx.txIn.entries()) {
      const unspentOutput = storage.getUnspentOutput(
        inTx.outpointHash,
        inTx.outpointIndex
      );
      if (!unspentOutput) {
        debug(`in ${index} not found in unspent`);
        continue;
      }

      const signatureData = isSignatureScriptLooksLikeP2PKH(inTx.script);
      if (typeof signatureData === "string") {
        debug(`in ${index} signature is not P2PKH: ${signatureData}`);
        storage.removeUnspendTx(unspentOutput.id);
        continue;
      }
      const signatureCheck = check_P2PKH_SIGHASH_ALL(
        tx,
        index,
        unspentOutput.pub_script
      );

      if (typeof signatureCheck === "string") {
        debug(`in ${index} signature not verified: ${signatureCheck}`);
        storage.removeUnspendTx(unspentOutput.id);

        if (signatureCheck === VERIFICATION_FAILED_RESULT) {
          warn(`signatureCheck=${signatureCheck} index=${index}`);
          warn(`Failed on this transaction`, tx);
          warn(`Txid=${Buffer.from(tx.txid).reverse().toString("hex")}`);
          warn(packTx(tx).toString("hex"));

          throw new Error(
            `Why we have unverified transaction in the blockchain?`
          );
        }

        continue;
      }

      const compressedPubKey = compressPublicKey(signatureCheck.pubKey);
      if (!compressedPubKey) {
        debug(`in ${index} problems to compress key`);
        storage.removeUnspendTx(unspentOutput.id);
        continue;
      }
      const isTheSameR = storage.saveSignatureDetails(
        compressedPubKey,
        signatureCheck.msg,
        signatureCheck.r,
        signatureCheck.s,
        blockInformation
        // tx.hash,
        // index
      );
      if (isTheSameR) {
        keysFound++;
      }
      savedSignatures++;

      storage.removeUnspendTx(unspentOutput.id);
      debug(`in ${index} saved`);
    }

    return { savedOutputsCount, savedSignatures, keysFound };
  }
  return {
    transaction,
  };
}
