import { packTx } from "../protocol/messages.create";
import { BitcoinTransaction } from "../protocol/messages.parse";
import { PkScript, SignatureScript } from "../protocol/messages.types";
import { sha256 } from "../utils/hashes";
import { joinBuffers } from "../utils/joinBuffer";

export function readHashCodeType(hashCodeType: number) {
  const isSigHashNone = (hashCodeType & 0x1f) === 0x00000002;
  const isSigHashSingle = (hashCodeType & 0x1f) === 0x00000003;
  const isSigHashAnyone = !!(hashCodeType & 0x00000080);
  return { isSigHashNone, isSigHashSingle, isSigHashAnyone };
}
export function packHashCodeType(
  hashCodeType: ReturnType<typeof readHashCodeType>
) {
  return (
    (hashCodeType.isSigHashAnyone ? 0x00000080 : 0) +
    (hashCodeType.isSigHashNone
      ? 0x02
      : hashCodeType.isSigHashSingle
      ? 0x03
      : 0)
  );
}

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
   */
  hashCodeType: number | ReturnType<typeof readHashCodeType>
) {
  const { isSigHashNone, isSigHashSingle, isSigHashAnyone } =
    typeof hashCodeType === "number"
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
