import { readTx } from "./messages.parse";
import { SignatureScript } from "./messages.types";
import { isSignatureScriptLooksLikeP2PKH, isSourceScriptP2PKH } from "./script";
import { sourceTxRaw, spendingTxRaw } from "./testdata";

// Bitcoin IDE
// https://vlad15june.github.io/bitcoinIDE/build/editor.html

describe(`Scripting`, () => {
  it(`isSourceScriptP2PKH`, () => {
    expect(
      isSourceScriptP2PKH(readTx(sourceTxRaw)[0].txOut[0].script)
    ).toStrictEqual(null);

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
      isSignatureScriptLooksLikeP2PKH(
        Buffer.from("002233", "hex") as SignatureScript
      )
    ).toBeFalsy();
  });
});
