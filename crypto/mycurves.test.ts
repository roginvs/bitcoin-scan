import { sha256 } from "../bitcoin/utils/hashes";
import { readTx } from "../bitcoin/protocol/messages.parse";
import { check_P2PKH_SIGHASH_ALL } from "../bitcoin/script/p2pkh";
import { sourceTxRaw, spendingTxRaw } from "../bitcoin/protocol/testdata";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { check_signature } from "../my-elliptic-curves/ecdsa";
import { uncompressPublicKey } from "../my-elliptic-curves/uncompressPublicKey";

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

    const msgHash = BigInt("0x" + sha256(result.msg).toString("hex"));

    const checkResult = check_signature({
      curve: Secp256k1,
      publicKey: uncompressPublicKey(Secp256k1, result.pubKey),
      msgHash,
      r: BigInt("0x" + result.r.toString("hex")),
      s: BigInt("0x" + result.s.toString("hex")),
    });

    expect(checkResult).toStrictEqual(true);
  });
});
