import { BitcoinTransaction } from "../protocol/messages.parse";
import { PkScript } from "../protocol/messages.types";

export function validateScript(
  pkScript: PkScript,
  tx: BitcoinTransaction,
  txInIndex: number
) {
  // TODO
}
