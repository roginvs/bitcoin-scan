import { packTxOut, packUint32, packVarInt } from "../protocol/messages.create";
import {
  BitcoinTransaction,
  BitcoinTransactionOut,
} from "../protocol/messages.parse";
import { PkScript } from "../protocol/messages.types";
import { dsha256, sha256 } from "../utils/hashes";
import { readHashCodeType } from "./hashCode";

/**
 * If it is P2WPKH then script is implied as this one
 */
export function p2wpkhProgramForOpChecksig(keyHash: Buffer) {
  if (keyHash.length !== 20) {
    throw new Error(`Wrong data`);
  }
  return Buffer.concat([
    Buffer.from("76a914", "hex"),
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
  sourceAmount: bigint,
  /**
   * We accept number to be able to contact exactly the same number
   * 0x01 is SIGHASH_ALL default
   */
  hashCodeType: number | ReturnType<typeof readHashCodeType>
) {
  const hashCode =
    typeof hashCodeType === "number"
      ? readHashCodeType(hashCodeType)
      : hashCodeType;

  const nVersion = packUint32(spending.version);

  const hashPrevouts = !hashCode.isSigHashAnyone
    ? dsha256(
        Buffer.concat([
          ...spending.txIn.flatMap((txIn) => [
            txIn.outpointHash,
            packUint32(txIn.outpointIndex),
          ]),
        ])
      )
    : Buffer.alloc(32, 0);

  const hashSequence =
    !hashCode.isSigHashAnyone &&
    !hashCode.isSigHashSingle &&
    !hashCode.isSigHashNone
      ? dsha256(
          Buffer.concat(spending.txIn.map((txIn) => packUint32(txIn.sequence)))
        )
      : Buffer.alloc(32, 0);

  const hashOutputs =
    !hashCode.isSigHashSingle && !hashCode.isSigHashNone
      ? dsha256(Buffer.concat(spending.txOut.map((txOut) => packTxOut(txOut))))
      : hashCode.isSigHashSingle && spendingIndex < spending.txOut.length
      ? dsha256(packTxOut(spending.txOut[spendingIndex]))
      : Buffer.alloc(32, 0);

  const prevOut = Buffer.concat([
    spending.txIn[spendingIndex].outpointHash,
    packUint32(spending.txIn[spendingIndex].outpointIndex),
  ]);

  const scriptCode = Buffer.concat([
    packVarInt(sourcePkScript.length),
    sourcePkScript,
  ]);

  const amount = Buffer.alloc(8);
  amount.writeBigUInt64LE(sourceAmount);

  console.info(scriptCode.toString("hex"));
  // TODO
  return Buffer.from("sdasd");
}
