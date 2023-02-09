import { createLogger } from "../../logger/logger";
import { compressPublicKey } from "../protocol/compressPublicKey";
import { packTx } from "../protocol/messages.create";
import { BitcoinTransaction } from "../protocol/messages.parse";
import { PkScript } from "../protocol/messages.types";
import {
  check_P2PKH_SIGHASH_ALL,
  FAILED_PUBHASHES_NOT_EQUAL,
  FAILED_VERIFICATION,
  isSignatureScriptLooksLikeP2PKH,
  isSourceScriptP2PKH,
} from "../script/script";

const { info, debug, warn } = createLogger("SCRIPT");

export function validateScript(
  pkScript: PkScript,
  tx: BitcoinTransaction,
  txInIndex: number
) {
  const pubKeyHash = isSourceScriptP2PKH(pkScript);
  if (typeof pubKeyHash === "string") {
    return;
  }

  const signatureData = isSignatureScriptLooksLikeP2PKH(
    tx.txIn[txInIndex].script
  );
  if (typeof signatureData === "string") {
    return;
  }

  // TODO: Check not only for SIGHASH_ALL
  const signatureCheck = check_P2PKH_SIGHASH_ALL(tx, txInIndex, pkScript);

  if (typeof signatureCheck === "string") {
    if (
      signatureCheck === FAILED_VERIFICATION ||
      signatureCheck === FAILED_PUBHASHES_NOT_EQUAL
    ) {
      warn(`signatureCheck=${signatureCheck} index=${txInIndex}`);
      warn(`Failed on this transaction`, tx);
      warn(`Txid=${Buffer.from(tx.txid).reverse().toString("hex")}`);
      warn(packTx(tx).toString("hex"));

      throw new Error(`Why we have unverified transaction in the blockchain?`);
    }

    return;
  }

  const compressedPubKey = compressPublicKey(signatureCheck.pubKey);
  if (!compressedPubKey) {
    warn(`Problems with public key: ${signatureCheck.pubKey.toString("hex")}`);
    throw new Error(`Failed to compress key for some reasons`);
    // storage.removeUnspendTx(unspentOutput.id);
    // continue;
  }

  // TODO: Call callback
  throw new Error("TODO: Found first P2PKH signature");
}
