import { packTx } from "../protocol/messages.create";
import { BitcoinTransaction, readTx } from "../protocol/messages.parse";
import { TransactionPayload } from "../protocol/messages.types";

export function getTxSize(tx: TransactionPayload | BitcoinTransaction) {
  const txFullRaw = tx instanceof Buffer ? tx : packTx(tx);
  const txNoWitness = packTx({
    ...(tx instanceof Buffer ? readTx(tx)[0] : tx),
    isWitness: false,
  });
  const size =
    tx instanceof Buffer
      ? tx.length
      : tx.isWitness
      ? txFullRaw.length
      : txNoWitness.length;
  const weight =
    txNoWitness.length * 4 + (txFullRaw.length - txNoWitness.length);
  return {
    size,
    weight,
    // noWitnessSize: txNoWitness.length,
    vbytes: weight / 4,
  };
}
