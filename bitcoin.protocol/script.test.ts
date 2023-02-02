import { sha256 } from "./hashes";
import { readTx } from "./messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionPayload,
} from "./messages.types";
import {
  check_P2PKH_SIGHASH_ALL,
  isSignatureScriptLooksLikeP2PKH,
  isSourceScriptP2PKH,
  VERIFICATION_FAILED_RESULT,
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

    // console.dir(result, { depth: null });
  });

  it(`Verifies transaction with witness`, () => {
    // Magic to split such string
    // .split(/(.{64})/).filter(x => x)

    const spendingRaw = Buffer.from(
      [
        "01000000000102a43a32534210f0af3436e263590b26554a544e2ee4aa48b06b",
        "00667780c8b5d0000000006b483045022100856c58def37ef5b701ce865a0392",
        "bebb38521fded2543ca3b30b77a87dcdf8c40220794d08af48f8c78700def25f",
        "b029557104ea3535b5b4e68ad647fe77f5b440a2012103ae8f91d2d97330edc5",
        "561805518a91178bc74c08b53879fe9769c659837d5a8bffffffff566978cc0d",
        "b5a605a42b26c18ea1144df9dd1b1a71997d93a6b101e11be054fe0000000000",
        "ffffffff011cd12d00000000001976a9149ff2deba0b4027c6225e4f97c470ec",
        "b52de9106d88ac0002483045022100bea9e757f3c407af04f567bc833b0ec7e6",
        "9520089e72efcb562165f058c5cc90022015f2be1196a363909b57480626e0fe",
        "1282807a83fe2b3747c5a934ccbf86466f0121036f6b062f37b883145cea4f69",
        "21d0fb5002bd509f760a8fecf70bc64ec9fe377800000000",
      ].join(""),
      "hex"
    ) as TransactionPayload;

    const pkScript = Buffer.from(
      "76a9146fbe35ac00cc26a3f0d0393da8e0ce47856b54d188ac",
      "hex"
    ) as PkScript;

    const [tx, rest] = readTx(spendingRaw);
    expect(rest.length).toBe(0);
    const result = check_P2PKH_SIGHASH_ALL(tx, 0, pkScript);

    if (typeof result === "string") {
      throw new Error(result);
    }
  });

  it(`Verifies weird tx`, () => {
    const spendingRaw = Buffer.from(
      [
        "0100000001d679773ff5c2feabc0e285509624a8afc52880f1ac3b72c4d7b942",
        "2bb751c393010000008a47304402208a2fc6d15e01f42098559914f7dcf79c12",
        "1839dacd2fe2eea4c3ea1624c8a06c022019ffa4b4d00a20bff88ef8d606d5e3",
        "773b4d74fe2190bed00efa0625cbc77d76014104cf6521219983c70844859e49",
        "ccbd687bf68a0bcd92bfe599e354d3750d0578b345179081572e12f54b30f25d",
        "56fc1b1e83715a625d6a21d6ffabdbf439b53a27ffffffff01d0ee1201000000",
        "001976a9147874d09fd0b25d8b688bd9b2488b94266055434f88ac00000000",
      ].join(""),
      "hex"
    ) as TransactionPayload;

    const pkScript = Buffer.from(
      "76a914de433e567820f062194a8ca86b487b16dbcb560e88ac",
      "hex"
    ) as PkScript;

    const [tx, rest] = readTx(spendingRaw);
    expect(rest.length).toBe(0);
    const result = check_P2PKH_SIGHASH_ALL(tx, 0, pkScript);

    if (typeof result === "string") {
      throw new Error(result);
    }
  });

  it(`Incorrect signature also catched`, () => {
    const spendingRaw = Buffer.from(
      [
        "0100000001d679773ff5c2feabc0e285509624a8afc52880f1ac3b72c4d7b942",
        "2bb751c393010000008a47304402208a2fc6d15e01f42098559914f7dcf79c12",
        "1839dacd2fe2eea4c3ea1624c8a06c022019ffa4b4d00a20bff88ef8d606d5e3",
        "773b4d74fe2190bed00efa0625cbc77d76014104cf6521219983c70844859e49",
        "ccbd687bf68a0bcd92bfe599e354d3750d0578b345179081572e12f54b30f25d",
        "56fc1b1e83715a625d6a21d6ffabdbf439b53a27ffffffff01d0ee1201000000",
        "001976a9147874d09fd0b25d8b688bd9b2488b94266055434f88ad00000000",
      ].join(""),
      "hex"
    ) as TransactionPayload;

    const pkScript = Buffer.from(
      "76a914de433e567820f062194a8ca86b487b16dbcb560e88ac",
      "hex"
    ) as PkScript;

    const [tx, rest] = readTx(spendingRaw);
    expect(rest.length).toBe(0);
    const result = check_P2PKH_SIGHASH_ALL(tx, 0, pkScript);

    expect(result).toBe(VERIFICATION_FAILED_RESULT);
  });
});
