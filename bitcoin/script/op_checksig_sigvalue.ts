import { packTx } from "../protocol/messages.create";
import { BitcoinTransaction } from "../protocol/messages.parse";
import { PkScript, SignatureScript } from "../protocol/messages.types";
import { sha256 } from "../utils/hashes";
import { joinBuffers } from "../utils/joinBuffer";
import { packHashCodeType, readHashCodeType } from "./hashCode";

export function getOpChecksigSignatureValue(
  spending: BitcoinTransaction,
  spendingIndex: number,
  /**
   * We expect that it already:
   *   - removed code before last OP_CODESEPARATORS
   *   - OP_CODESEPARATORS removed
   *   - removed signatures
   */
  sourcePkScript: PkScript,
  /**
   * We accept number to be able to contact exactly the same number
   * 0x01 is SIGHASH_ALL default
   */
  hashCodeType: number | ReturnType<typeof readHashCodeType>
) {
  const {
    isSigHashNone,
    isSigHashSingle,
    isSigHashAnyoneCanPay: isSigHashAnyone,
  } = typeof hashCodeType === "number"
    ? readHashCodeType(hashCodeType)
    : hashCodeType;

  const txNew: BitcoinTransaction = {
    ...spending,
    isWitness: false,
    txIn: spending.txIn
      .map((txIn, index) => {
        if (index === spendingIndex) {
          return {
            ...txIn,
            // We do not check OP_CODESEPARATORS here
            script: sourcePkScript as Buffer as SignatureScript,
          };
        }
        if (isSigHashAnyone) {
          return null;
        }
        return {
          ...txIn,
          sequence: isSigHashNone || isSigHashSingle ? 0 : txIn.sequence,
          script: Buffer.alloc(0) as SignatureScript,
        };
      })
      .filter((x) => x)
      .map((x) => x!),
    txOut: isSigHashNone
      ? []
      : isSigHashSingle
      ? spending.txOut.slice(0, spendingIndex + 1).map((txOut, index) => {
          if (index === spendingIndex) {
            return txOut;
          }
          return {
            script: Buffer.alloc(0) as PkScript,
            value: BigInt("0xFFFFFFFFFFFFFFFF"),
          };
        })
      : spending.txOut,
  };

  const dataToVerify = sha256(
    joinBuffers(
      packTx(txNew),
      Buffer.from([
        typeof hashCodeType === "number"
          ? hashCodeType
          : packHashCodeType(hashCodeType),
        0,
        0,
        0,
      ])
    )
  );

  return dataToVerify;
}
