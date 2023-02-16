import {
  BitcoinTransaction,
  BitcoinTransactionOut,
} from "../protocol/messages.parse";
import { PkScript } from "../protocol/messages.types";
import { readHashCodeType } from "./hashCode";

/**
 * If it is P2WPKH then script is implied as this one
 */
export function p2wpkhProgramForOpChecksig(keyHash: Buffer) {
  if (keyHash.length !== 20) {
    throw new Error(`Wrong data`);
  }
  return Buffer.concat([
    Buffer.from("1976a914", "hex"),
    keyHash,
    Buffer.from("88ac", "hex"),
  ]) as PkScript;
}
export function getOpChecksigSignatureValueWitness(
  spending: BitcoinTransaction,
  spendingIndex: number,
  /**
   * We expect that it already:
   *   - removed code before last OP_CODESEPARATORS
   */
  sourcePkScript: PkScript,
  /**
   * We accept number to be able to contact exactly the same number
   * 0x01 is SIGHASH_ALL default
   */
  hashCodeType: number | ReturnType<typeof readHashCodeType>
) {
  // TODO
  return Buffer.from("sdasd");
}
