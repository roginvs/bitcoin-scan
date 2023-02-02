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

  it(`Verifies one more weird tx`, () => {
    const spendingRaw = Buffer.from(
      [
        "0100000009e4fe9f7073eae8af1d67489c34d7625be9fb3a058629f073360dae",
        "f15f2efd1d010000008c493045022035da0db7a7aa1a43971767ba9390485681",
        "e339813381f842704b536727846df70221009076ede95d8e7df7ce483a587b33",
        "5d63531acac7d1b6cf08350dd7fcd89ccb1d000141046bb99bb9e71205eb3e99",
        "3db2274069eba9bac5627e546685aeb01a5acdefc3d704ebafa1a7bff71c8c2b",
        "480cc77ee29410d830e3a199546ef7be0a8861b49cf4ffffffff47e4b4813a48",
        "5e890ef9f625ff18562a979dfb6b6b40a7c043bc6bab9732d6d4010000008c49",
        "3045022100e859b3bd7dad710184bb0a98b2dfd0c869938a72be9597bcb43a55",
        "f37505c15202203e523dadd8328164eddb673f4cf188b6153656b9f5b813cd5e",
        "41546b293f7189000141046bb99bb9e71205eb3e993db2274069eba9bac5627e",
        "546685aeb01a5acdefc3d704ebafa1a7bff71c8c2b480cc77ee29410d830e3a1",
        "99546ef7be0a8861b49cf4ffffffff240b3974ed53535d702e7096a83d124cad",
        "c405fdca4f24a3ca19102afbcfeeb5010000008c493046022100ec5d89384cfc",
        "dbe653ad8e12a36d1274c4ddfe976521de47c94011575e471e32022100e3c544",
        "06b93d1822bcb1dbd0fc78a5603908189efb679989222d17f1bbca7519014104",
        "6bb99bb9e71205eb3e993db2274069eba9bac5627e546685aeb01a5acdefc3d7",
        "04ebafa1a7bff71c8c2b480cc77ee29410d830e3a199546ef7be0a8861b49cf4",
        "ffffffff132e1ecd741a63ce8d2f084d8bd5540adab3fdc955356db490f15dd4",
        "3c45a6e8010000008c493046022100f8b5a1351b21ed8f603e55fc487ada5d40",
        "887279bbb54072e0106a3822db9de202210087c3b68f5f4234528149a6c10600",
        "5a12ad422921045140af4bd5469dc0a643750141046bb99bb9e71205eb3e993d",
        "b2274069eba9bac5627e546685aeb01a5acdefc3d704ebafa1a7bff71c8c2b48",
        "0cc77ee29410d830e3a199546ef7be0a8861b49cf4ffffffff82f84000017834",
        "1db8e2a1a7f71da6ce9db816d937d928f024e1d9e8c084cefd010000008c4930",
        "4402202bf0fc1bd940639159324857e34f990b7ec8403e13a02361983612fa99",
        "7661b1022042378e48b1a2ddbf2ef46cb00c5d359cb86c852c1afa37dea07d9c",
        "0b0f682a7a00000141046bb99bb9e71205eb3e993db2274069eba9bac5627e54",
        "6685aeb01a5acdefc3d704ebafa1a7bff71c8c2b480cc77ee29410d830e3a199",
        "546ef7be0a8861b49cf4ffffffffda5f257e62b9f778d93fd72a5f9f2048c752",
        "2a4dd0f72ecd75bd77159a933e16010000008c493045022043fa233ca9ca5c75",
        "bca6d1f4f306ef900ea8ea0b9d1627347ba42fbc9805c4230221008d0064352d",
        "172bf71210d64d0aba39078306926602db797730e5dde2ada2d79d000141046b",
        "b99bb9e71205eb3e993db2274069eba9bac5627e546685aeb01a5acdefc3d704",
        "ebafa1a7bff71c8c2b480cc77ee29410d830e3a199546ef7be0a8861b49cf4ff",
        "ffffff6d259e6183ff68f51a80398ecaa9287533e188a3af5b9ebb2c93bf2c5b",
        "1d85ac010000008c4930450221008557c54e0c70972b1e76733240a4958a20cc",
        "816ad7a3462f11107c3e77b6f32302206f5935fd5ccad15eb8580d93605fca0f",
        "b4652f9bb9e530ca0cc081069936e047000141046bb99bb9e71205eb3e993db2",
        "274069eba9bac5627e546685aeb01a5acdefc3d704ebafa1a7bff71c8c2b480c",
        "c77ee29410d830e3a199546ef7be0a8861b49cf4ffffffff4495ccc205c9c6e7",
        "17adb07c43bc52b1dfcacbbc9ca302d0cd9129e07e3ed564010000008c493045",
        "022100bc16a615fb14d4d5f12ed3aa50a94be139b96da160923be215ff8bd5a8",
        "c22c7702204728ea18241f73c2b229837d97ee67ec3b2e4fb4cfbc76f96e25ef",
        "90ce8b866f000141046bb99bb9e71205eb3e993db2274069eba9bac5627e5466",
        "85aeb01a5acdefc3d704ebafa1a7bff71c8c2b480cc77ee29410d830e3a19954",
        "6ef7be0a8861b49cf4ffffffffad6fe2df6ebafa358e7f4c43beda17b9f96d59",
        "a46d6fd012ccb9c0a87d470882010000008c4930450221008b44f5cca56ce852",
        "48f77b8a4f65311904b785f48a8ce5dab8ab95ab8be0782c02200fa194ab092f",
        "6c7e5c6ef87a5cb9defec8d20cf6eec35cc7a379469046d4af7d000141046bb9",
        "9bb9e71205eb3e993db2274069eba9bac5627e546685aeb01a5acdefc3d704eb",
        "afa1a7bff71c8c2b480cc77ee29410d830e3a199546ef7be0a8861b49cf4ffff",
        "ffff0100a6a63a000000001976a91407a2bc41a410629bf3055f6c73b0fc32aa",
        "d822ac88ac00000000",
      ].join(""),
      "hex"
    ) as TransactionPayload;

    const pkScript = Buffer.from(
      "76a9145811cfd9bc24826c2ed456e14fbd79525387bc9d88ac",
      "hex"
    ) as PkScript;

    const [tx, rest] = readTx(spendingRaw);
    expect(rest.length).toBe(0);
    const result = check_P2PKH_SIGHASH_ALL(tx, 1, pkScript);

    if (typeof result === "string") {
      throw new Error(result);
    }
  });
});
