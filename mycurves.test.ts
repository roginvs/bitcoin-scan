import { sha256 } from "./bitcoin/hashes";
import { readTx } from "./bitcoin/messages.parse";
import { check_P2PKH_SIGHASH_ALL } from "./bitcoin/script";
import { sourceTxRaw, spendingTxRaw } from "./bitcoin/testdata";
import { Secp256k1 } from "./my-elliptic-curves/curves.named";
import { check_signature } from "./my-elliptic-curves/ecdsa";

describe(`Scripting`, () => {
  it(`Verify transactions with BigInt implementation`, () => {
    const spendingTxParsed = readTx(spendingTxRaw)[0];

    const sourceTxParsed = readTx(sourceTxRaw)[0];

    const sourcePkScript =
      sourceTxParsed.txOut[spendingTxParsed.txIn[0].outpointIndex].script;

    const result = check_P2PKH_SIGHASH_ALL(spendingTxParsed, 0, sourcePkScript);

    if (typeof result === "string") {
      throw new Error(result);
    }
    /*
    const checkResult = check_signature({
      curve: Secp256k1,
      get,
      msgHash,
      r,
      s,
    });
    */

    console.dir(result, { depth: null });
  });
});
