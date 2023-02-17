import { packTxOut, packUint32, packVarInt } from "../protocol/messages.create";
import {
  BitcoinTransaction,
  BitcoinTransactionOut,
} from "../protocol/messages.parse";
import { PkScript } from "../protocol/messages.types";
import { dsha256, sha256 } from "../utils/hashes";
import { packHashCodeType, readHashCodeType } from "./hashCode";

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
/**
 * Check BIP-0143 for more details
 */
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

  const bufs: Buffer[] = [];

  bufs.push(packUint32(spending.version));

  {
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
    bufs.push(hashPrevouts);
  }
  {
    const hashSequence =
      !hashCode.isSigHashAnyone &&
      !hashCode.isSigHashSingle &&
      !hashCode.isSigHashNone
        ? dsha256(
            Buffer.concat(
              spending.txIn.map((txIn) => packUint32(txIn.sequence))
            )
          )
        : Buffer.alloc(32, 0);
    bufs.push(hashSequence);
  }

  {
    const prevOut = Buffer.concat([
      spending.txIn[spendingIndex].outpointHash,
      packUint32(spending.txIn[spendingIndex].outpointIndex),
    ]);
    bufs.push(prevOut);
  }

  {
    const scriptCode = Buffer.concat([
      packVarInt(sourcePkScript.length),
      sourcePkScript,
    ]);
    bufs.push(scriptCode);
  }

  {
    const amount = Buffer.alloc(8);
    amount.writeBigUInt64LE(sourceAmount);
    bufs.push(amount);
  }

  {
    const nSequence = packUint32(spending.txIn[spendingIndex].sequence);
    bufs.push(nSequence);
  }

  {
    const hashOutputs =
      !hashCode.isSigHashSingle && !hashCode.isSigHashNone
        ? dsha256(
            Buffer.concat(spending.txOut.map((txOut) => packTxOut(txOut)))
          )
        : hashCode.isSigHashSingle && spendingIndex < spending.txOut.length
        ? dsha256(packTxOut(spending.txOut[spendingIndex]))
        : Buffer.alloc(32, 0);
    bufs.push(hashOutputs);
  }

  bufs.push(packUint32(spending.lockTime));
  bufs.push(
    packUint32(
      typeof hashCodeType === "number"
        ? hashCodeType
        : packHashCodeType(hashCodeType)
    )
  );

  const buf = Buffer.concat(bufs);

  const hash = sha256(buf);
  return hash;
}
