import { readTx } from "./messages.parse";
import { isSourceScriptP2PKH } from "./script";
import { sourceTxRaw } from "./testdata";

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
});
