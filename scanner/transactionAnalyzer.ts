import { compressPublicKey } from "../bitcoin/protocol/compressPublicKey";
import { packTx } from "../bitcoin/protocol/messages.create";
import { BitcoinTransaction } from "../bitcoin/protocol/messages.parse";
import {
  check_P2PKH_SIGHASH_ALL,
  isSignatureScriptLooksLikeP2PKH,
  isSourceScriptP2PKH,
  FAILED_VERIFICATION,
  FAILED_PUBHASHES_NOT_EQUAL,
} from "../bitcoin/protocol/script";
import { createTransactionsStorage } from "./database/scanner.database";
import { createLogger } from "../logger/logger";
import { derivePrivateKeyFromPair } from "../crypto/keyDerive";
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
      if (!storage.getUnspentOutput(tx.txid, index)) {
        debug(`out ${index} added to unspent`);
        storage.addUnspentTxOutput(tx.txid, index, outTx.script);
        savedOutputsCount++;
      }
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

        if (
          signatureCheck === FAILED_VERIFICATION ||
          signatureCheck === FAILED_PUBHASHES_NOT_EQUAL
        ) {
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
        warn(
          `Problems with public key: ${signatureCheck.pubKey.toString("hex")}`
        );
        throw new Error(`Failed to compress key for some reasons`);
        // storage.removeUnspendTx(unspentOutput.id);
        // continue;
      }

      const signaturesWithSameR = storage.getSignatures(
        compressedPubKey,
        signatureCheck.r
      );
      if (
        signaturesWithSameR.some((valuesInDb) =>
          valuesInDb.s.equals(signatureCheck.s)
        )
      ) {
        // Ok, we already have data with such compressed_public_key,r,s
        // Probably because we check the same transaction once again, for example after restart
        continue;
      }

      if (
        signaturesWithSameR.length > 0 &&
        !storage.doWeHavePrivateKeyForThisPubKey(compressedPubKey)
      ) {
        // It definitely will be another r because we checked it above
        const anotherSig = signaturesWithSameR[0];

        const key = derivePrivateKeyFromPair(anotherSig, {
          compressed_public_key: compressedPubKey,
          msg: signatureCheck.msg,
          r: signatureCheck.r,
          s: signatureCheck.s,
        });
        storage.savePrivateKey(
          compressedPubKey,
          key.walletStringComp,
          key.walletStringUncomp,
          key.privateKeyBuf,
          Buffer.from(tx.txid).reverse()
        );
        keysFound++;
      }

      storage.saveSignature(
        compressedPubKey,
        signatureCheck.msg,
        signatureCheck.r,
        signatureCheck.s
      );
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
