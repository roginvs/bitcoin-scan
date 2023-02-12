import { sha256 } from "../utils/hashes";
import { readTx } from "../protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionPayload,
} from "../protocol/messages.types";
import {
  check_P2PKH,
  isSignatureScriptLooksLikeP2PKH,
  isSourceScriptP2PKH,
} from "./p2pkh";
import { sourceTxRaw, spendingTxRaw } from "../protocol/testdata";

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

    const result = check_P2PKH(spendingTxParsed, 0, sourcePkScript);

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
    const result = check_P2PKH(tx, 0, pkScript);

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
    const result = check_P2PKH(tx, 0, pkScript);

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
    expect(() => check_P2PKH(tx, 0, pkScript)).toThrow();
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
    const result = check_P2PKH(tx, 1, pkScript);

    if (typeof result === "string") {
      throw new Error(result);
    }
  });

  it(`Verifies one more weird tx 2`, () => {
    const spendingRaw = Buffer.from(
      [
        "010000000a70194525bb2b4bd4cf05f2465529bde0def44713dfa421367b2e7bd136a68055000000008b483045022012dd6cc0fe6a661fce5d42782031b214491187d4393b36a082c12d7068294c4a022100dd6ad6eb032b532d651d9bf24dfe88518e7dd78a0e628812e4e89944e5948ea80141048934355ab4b000594645f44712d4f7090db0485d08ae1b7d0557de6610ff62fc6dcf3d61968c0859521af5d565bd78051ee01f6df8cf6a902a365cefa9820e00ffffffff798bc7519172d652fa5fc4435a8ebc218d0c673ebdc697bdf3b3b4f78c6bf319010000008b48304502210081aeb60e1f3e3488af58a05b047e17dbeed39809b11621f3b90fa768aa1d355802204467e4f846e5e258021166948d5ea3c629a413bb225ca7ca27b97606b34c9c43014104452af26bbb2c7c21f504a304f406cc0cd48c95cf5290d621dcc3a685b4a92cddd81af5e5bed97b1c11b5cba2dfba915d530ecbd63c6880e6d3c2afe5d5a0591bffffffffe57c81787a7e6e4efaeddee0c8de67c3306a73a5d47abe3764936b8c3c50fe48000000008b4830450221009b13d2e29616797c269894f77e9d189e02c9db495be72035aa874fb768e8732e022030b7aaf10f5510a8f299992c3bf58594a974c90ed85543e261577508074ee42b014104714a532f6eb233b1ceef2e4586cf4ea9db22fcfdde02ff8e0618b0f3f21b7742af49a365012f88143168e821cca061e324786f5daa6ede97cf1136c2bd0c7490fffffffff07a3b9af05655367139a1d55a6890c0b673580b07e4581f3f164103a16e3af6010000008b48304502200ecc5cf1ce725450866955ecf13df317a99fbb7e22a742058e4fe3748133cd5d022100d0c9dbdcc3186ad5dd85a94d0c61965bdf94f4da28294af6fcd485b1fef2855b014104d236f7de8ff42d02a5549c4188c3c49dbbee36874310e81c776b0c7859e8b50cd1b168eb06529e972adc2259f60c62b94652f765ec38098811aa1caf3e8ba127ffffffff8af8bfdd9d01d3e5e0f2dc0e6bd1867a016e483efd9145d296f029e4b1fe85dd010000008a4730440220004b09f3a9d3e560667de78d87620ef31921d425dcc192f74f0dcc78d867fdcf022030287d7e296e23314d16f2a22d3627c92eb53b55b8a9c44658beff3f3ba253480141049bd1db22d5cf7441bea1ce91dfe9a49ed29e0af6e39292a3762778e9233154d1d87cc02b616871e31ebfad2d205f008096c6e10412cec8708256a555efdf75ffffffffff3ff67c4bf8078589c57c9310f75942fa975b6f9adabadcf4eb4f65a5f482403a010000008b48304502205d8a6aa7ae67758f6f371d0fc1ee883b900ccb23117d3788977d17b5a1b5276d022100f0af2ffb847fdfb036b30bc177a98ba252e725d0adc2f5f120920e5d32dcac61014104a1f439e46c61d210b1b7bc36626b5a812bed8201c72d887d44edcbff00fb451991a6b849ddb8697ac6fa8abb5d3ebd247e974a57656ecd5d88198aa24297153cffffffff337406a29e129018e922bc90c8f250eed040729bbaa18e1c9a782d0ac09c1f56010000008c493046022100b45d2ae023db8368e3a9f550a5ae1d068346c68d1ab5ee60efbe298d97e5464d022100a45b0f69df5a2586db1158ec325cae145648283c877552c60fe641424a14fabd0141040d8fb7dde40235500d462ff3fa9c7619179e43a4263c24dd62f173166ba686594a36172e833762036d3139b11bf1de1046561934d813ba9f6bf5d381db71c51cffffffff084ff9ee27f7a4cc94706b73b84db5343f500a7fc00dca1eb2f6b073004cda273b0000008a47304402206069288ef2c123c9c9967022e6a3990c4569f93329f9f36f57ebed45d8a51e30022058c19e5bccb74a3f0e4372779a0e61e45fcdb51455c21e8c2847b0b6f35529750141042edfaeb02509aab613a9151a42d582d5baeedd44dc5d8a7314b2dccd431695e03e5ad55dd8c87effb4a458210e5f1405cda47bd31828135ed92c2d41d11ae877ffffffff1ffc88b85b26f1c43f0a392b8a6e7c39a2d038037f366d1daca62688f885ddd0300000008b48304502210090606d4d6c0982d3efc2f827f5406c3b54f289393f82905b9a4182dda1afb2a402200171b19cf16f5ec6ffe4e3cee3d29e0c57ffb0b601e6704ae8402299257a06370141042edfaeb02509aab613a9151a42d582d5baeedd44dc5d8a7314b2dccd431695e03e5ad55dd8c87effb4a458210e5f1405cda47bd31828135ed92c2d41d11ae877ffffffff899d368692b96f9672f809d0c4070758b2b4412e3e9c6aff75ad2639e4b6db2b620000008c4930460221008f45eecf4354d0d067d3958112a9e5cb8508c9e5b13eff2221fabd6e8131e345022100b4e00c3c52b17d72383835d58f5229320e08ff69ca5fd7cda0f693136b30c8d1014104dd2b7bb58864fdbac9787b484d2195851365787a8868b8213750e2733a13a156e2ab47e4931b8f62fcf942d5a555d6d2ffe0cbda30e6089b614e5ddfd1f43202ffffffff0142acff0e000000001976a914d9a7a36ff5c89c22169c9cb22d18087a85a62ee288ac00000000",
      ].join(""),
      "hex"
    ) as TransactionPayload;

    const pkScript = Buffer.from(
      "76a9149efb0e3115e0cf08adf33c92d49ef78721edadd888ac",
      "hex"
    ) as PkScript;

    const [tx, rest] = readTx(spendingRaw);

    expect(rest.length).toBe(0);
    const result = check_P2PKH(tx, 4, pkScript);

    if (typeof result === "string") {
      throw new Error(result);
    }
  });

  it(`Verifies hashCodeType = 0x02`, () => {
    const result = check_P2PKH(
      readTx(
        Buffer.from(
          "01000000015f386c8a3842c9a9dcfa9b78be785a40a7bda08b64646be3654301eaccfc8d5e010000008a4730440220bb4fbc495aa23babb2c2be4e3fb4a5dffefe20c8eff5940f135649c3ea96444a022004afcda966c807bb97622d3eefea828f623af306ef2b756782ee6f8a22a959a2024104f1939ae6b01e849bf05d0ed51fd5b92b79a0e313e3f389c726f11fa3e144d9227b07e8a87c0ee36372e967e090d11b777707aa73efacabffffa285c00b3622d6ffffffff0240420f00000000001976a914660d4ef3a743e3e696ad990364e555c271ad504b88ac2072c801000000001976a91421c43ce400901312a603e4207aadfd742be8e7da88ac00000000",
          "hex"
        ) as TransactionPayload
      )[0],
      0,
      Buffer.from(
        "76a91421c43ce400901312a603e4207aadfd742be8e7da88ac",
        "hex"
      ) as PkScript
    );

    if (typeof result === "string") {
      throw new Error(result);
    }
  });

  it(`Verifies hashCodeType = 129`, () => {
    const result = check_P2PKH(
      readTx(
        Buffer.from(
          "0100000002f6044c0ad485f633b41f97d0d793eb2837ae40f738ff6d5f50fdfd10528c1d76010000006b48304502205853c7f1395785bfabb03c57e962eb076ff24d8e4e573b04db13b45ed3ed6ee20221009dc82ae43be9d4b1fe2847754e1d36dad48ba801817d485dc529afc516c2ddb481210305584980367b321fad7f1c1f4d5d723d0ac80c1d80c8ba12343965b48364537affffffff9c6af0df6669bcded19e317e25bebc8c78e48df8ae1fe02a7f030818e71ecd40010000006c4930460221008269c9d7ba0a7e730dd16f4082d29e3684fb7463ba064fd093afc170ad6e0388022100bc6d76373916a3ff6ee41b2c752001fda3c9e048bcff0d81d05b39ff0f4217b2812103aae303d825421545c5bc7ccd5ac87dd5add3bcc3a432ba7aa2f2661699f9f659ffffffff01e0930400000000001976a9145c11f917883b927eef77dc57707aeb853f6d389488ac00000000",
          "hex"
        ) as TransactionPayload
      )[0],
      0,
      Buffer.from(
        "76a9148551e48a53decd1cfc63079a4581bcccfad1a93c88ac",
        "hex"
      ) as PkScript
    );

    if (typeof result === "string") {
      throw new Error(result);
    }
  });

  it(`Verifies hashCodeType = 0x03`, () => {
    const result = check_P2PKH(
      readTx(
        Buffer.from(
          "010000000370ac0a1ae588aaf284c308d67ca92c69a39e2db81337e563bf40c59da0a5cf63000000006a4730440220360d20baff382059040ba9be98947fd678fb08aab2bb0c172efa996fd8ece9b702201b4fb0de67f015c90e7ac8a193aeab486a1f587e0f54d0fb9552ef7f5ce6caec032103579ca2e6d107522f012cd00b52b9a65fb46f0c57b9b8b6e377c48f526a44741affffffff7d815b6447e35fbea097e00e028fb7dfbad4f3f0987b4734676c84f3fcd0e804010000006b483045022100c714310be1e3a9ff1c5f7cacc65c2d8e781fc3a88ceb063c6153bf950650802102200b2d0979c76e12bb480da635f192cc8dc6f905380dd4ac1ff35a4f68f462fffd032103579ca2e6d107522f012cd00b52b9a65fb46f0c57b9b8b6e377c48f526a44741affffffff3f1f097333e4d46d51f5e77b53264db8f7f5d2e18217e1099957d0f5af7713ee010000006c493046022100b663499ef73273a3788dea342717c2640ac43c5a1cf862c9e09b206fcb3f6bb8022100b09972e75972d9148f2bdd462e5cb69b57c1214b88fc55ca638676c07cfc10d8032103579ca2e6d107522f012cd00b52b9a65fb46f0c57b9b8b6e377c48f526a44741affffffff0380841e00000000001976a914bfb282c70c4191f45b5a6665cad1682f2c9cfdfb88ac80841e00000000001976a9149857cc07bed33a5cf12b9c5e0500b675d500c81188ace0fd1c00000000001976a91443c52850606c872403c0601e69fa34b26f62db4a88ac00000000",
          "hex"
        ) as TransactionPayload
      )[0],
      0,
      Buffer.from(
        "76a914dcf72c4fd02f5a987cf9b02f2fabfcac3341a87d88ac",
        "hex"
      ) as PkScript
    );

    if (typeof result === "string") {
      throw new Error(result);
    }
  });
});
