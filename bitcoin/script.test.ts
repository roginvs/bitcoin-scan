import { sha256 } from "./hashes";
import { readTx } from "./messages.parse";
import { SignatureScript } from "./messages.types";
import {
  check_P2PKH_SIGHASH_ALL,
  isSignatureScriptLooksLikeP2PKH,
  isSourceScriptP2PKH,
} from "./script";
import { sourceTxRaw, spendingTxRaw } from "./testdata";

// Bitcoin IDE
// https://vlad15june.github.io/bitcoinIDE/build/editor.html

describe(`Scripting`, () => {
  it(`isSourceScriptP2PKH`, () => {
    expect(
      typeof isSourceScriptP2PKH(readTx(sourceTxRaw)[0].txOut[0].script)
    ).toBe("string");

    expect(
      isSourceScriptP2PKH(readTx(sourceTxRaw)[0].txOut[1].script)?.toString(
        "hex"
      )
    ).toBe("9c13abeaa29473787191861f62952f651ce6edac");
  });

  it(`isSignatureScriptLooksLikeP2PKH`, () => {
    const spending0 = isSignatureScriptLooksLikeP2PKH(
      readTx(spendingTxRaw)[0].txIn[0].script
    );
    expect(spending0).toBeTruthy();

    const source0 = isSignatureScriptLooksLikeP2PKH(
      readTx(sourceTxRaw)[0].txIn[0].script
    );
    expect(source0).toBeTruthy();

    expect(
      typeof isSignatureScriptLooksLikeP2PKH(
        Buffer.from("002233", "hex") as SignatureScript
      )
    ).toBe("string");
  });

  it(`Verify transactions`, () => {
    const spendingTxParsed = readTx(spendingTxRaw)[0];
    if (spendingTxParsed.txIn.length !== 1) {
      throw new Error(`LOL we want 1 input`);
    }

    if (
      !spendingTxParsed.txIn[0].outpointHash.equals(sha256(sha256(sourceTxRaw)))
    ) {
      throw new Error(`Our source transaction is wrong`);
    }

    const sourceTxParsed = readTx(sourceTxRaw)[0];

    const sourcePkScript =
      sourceTxParsed.txOut[spendingTxParsed.txIn[0].outpointIndex].script;

    const result = check_P2PKH_SIGHASH_ALL(spendingTxParsed, 0, sourcePkScript);

    if (typeof result === "string") {
      throw new Error(result);
    }

    console.dir(result, { depth: null });
  });
});
