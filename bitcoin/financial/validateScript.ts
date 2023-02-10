import { createLogger } from "../../logger/logger";
import { compressPublicKey } from "../protocol/compressPublicKey";
import { packTx } from "../protocol/messages.create";
import { BitcoinTransaction } from "../protocol/messages.parse";
import { PkScript } from "../protocol/messages.types";
import { check_P2PKH } from "../script/p2pkh";
import { ECDSASignatureValidatedListener } from "../script/types";

const { info, debug, warn } = createLogger("SCRIPT");

export function validateScript(
  pkScript: PkScript,
  tx: BitcoinTransaction,
  txInIndex: number,
  onValidatedSignature: ECDSASignatureValidatedListener
) {
  const signatureCheck = check_P2PKH(tx, txInIndex, pkScript);

  if (typeof signatureCheck === "string") {
    // This type of script is not supported yet
    return true;
  }

  onValidatedSignature(signatureCheck);
}
