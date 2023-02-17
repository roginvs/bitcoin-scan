import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  Verify,
  verify,
} from "crypto";
import { compressPublicKey } from "../../bitcoin/protocol/compressPublicKey";
import { packTx } from "../../bitcoin/protocol/messages.create";
import {
  BitcoinTransaction,
  readTx,
} from "../../bitcoin/protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionHash,
  TransactionPayload,
  WitnessStackItem,
} from "../../bitcoin/protocol/messages.types";
import { asn1parse, packAsn1PairOfIntegers } from "../../bitcoin/script/asn1";
import { extract_sig_r_and_s_from_der } from "../../bitcoin/script/extract_sig_r_and_s_from_der";
import { getOpChecksigSignatureValue } from "../../bitcoin/script/op_checksig_sigvalue";
import {
  getOpChecksigSignatureValueWitness,
  p2wpkhProgramForOpChecksig,
} from "../../bitcoin/script/op_checksig_sigvalue_witness";
import {
  bitcoinAddressP2WPKHromPublicKey,
  bitcoinAddressP2WSHromPKScript,
  getP2WSHpkscriptFromRealPkScript,
} from "../../bitcoin/utils/bech32/address";
import { ripemd160, sha256 } from "../../bitcoin/utils/hashes";
import { Secp256k1 } from "../../my-elliptic-curves/curves.named";
import { signature } from "../../my-elliptic-curves/ecdsa";
import { bigintToBuf } from "../../scanner/bigIntToBuf";

const myPrivKeyObject = createPrivateKey({
  key: (() => {
    const privateKey = Buffer.from("00".repeat(31) + "01", "hex");
    const privKeySec1 = Buffer.from(
      "300E0201010400" + privateKey.toString("hex") + "a00706052b8104000a",
      "hex"
    );

    const diff = privateKey.length;
    privKeySec1[1] += diff;
    privKeySec1[6] += diff;
    return privKeySec1;
  })(),
  format: "der",
  type: "sec1",
});
const myPublicKeyObject = createPublicKey(myPrivKeyObject);

const myPublicKey = (() => {
  const myPublicKeySpki = myPublicKeyObject.export({
    format: "der",
    type: "spki",
  });
  const asnParsed = asn1parse(myPublicKeySpki);
  // .subarray(20 + 2 + 1, 20 + 2 + 1 + 66);
  const myPublicKeyUncompressed = asnParsed[0][1].value;
  if (
    myPublicKeyUncompressed[0] !== 0x04 ||
    myPublicKeyUncompressed.length !== 65
  ) {
    throw new Error(
      `Something wrong or crypto module decided to compress public key`
    );
  }
  return compressPublicKey(myPublicKeyUncompressed)!;
})();

console.info("Public key = ", myPublicKey.toString("hex"));
console.info(
  `Public key hash = ${ripemd160(sha256(myPublicKey)).toString("hex")}`
);

const p2wpkh = bitcoinAddressP2WSHromPKScript(
  Buffer.from("AC", "hex") as PkScript
);
console.info(`Address 0xAC = ${p2wpkh}`);

const myPkScript = Buffer.from(
  "00149cfad00d405130ea4e8a4d5d381a5c8a4642fa2e",
  "hex"
) as PkScript;

export function createLOLTransaction() {
  const spending = {
    txid: Buffer.from(
      "4fa45f73a7da1b421697543c17361f5fb8e8c6c80679684f5c3d27767fec9bd2",
      "hex"
    ).reverse() as TransactionHash,
    outIndex: 0,
    value: BigInt(4000),

    /** For signing and for charge */
    pkscript: Buffer.from("AC", "hex") as PkScript,
  };

  const fee = BigInt(2000);

  const spendingTx: BitcoinTransaction = {
    version: 2,
    lockTime: 0,
    isWitness: true,
    txIn: [
      {
        outpointHash: spending.txid,
        outpointIndex: spending.outIndex,
        sequence: 0xfffffffe,
        script: Buffer.alloc(0) as SignatureScript,
        witness: [
          // This is signature+hashCodeType. Adding here to estimate size, we will replace it later
          Buffer.alloc(73, 0xff) as WitnessStackItem,
          myPublicKey as WitnessStackItem,
          spending.pkscript as Buffer as WitnessStackItem,
        ],
      },
    ],

    txOut: [
      {
        script: myPkScript,
        value: spending.value - fee,
      },
    ],

    txid: Buffer.alloc(0) as TransactionHash,
    wtxid: Buffer.alloc(0) as TransactionHash,
    payload: Buffer.alloc(0) as TransactionPayload,
  };

  const dataToSig = getOpChecksigSignatureValueWitness(
    spendingTx,
    0,
    spending.pkscript,
    spending.value,
    0x01
  );

  const signatureDer = (() => {
    const sigDer = sign(undefined, dataToSig, myPrivKeyObject);
    const [r, s] = extract_sig_r_and_s_from_der(sigDer);
    const sInt = BigInt("0x" + s.toString("hex"));
    if (sInt < Secp256k1.n / BigInt(2)) {
      return sigDer;
    }

    const sNew = Secp256k1.n - sInt;

    const sigDerNew = packAsn1PairOfIntegers(r, bigintToBuf(sNew));
    if (!verify(undefined, dataToSig, myPublicKeyObject, sigDerNew)) {
      throw new Error("Something wrong with signatures");
    }
    return sigDerNew;
  })();

  const signatureWithHashType = Buffer.concat([
    signatureDer,
    Buffer.from([0x01]),
  ]);

  spendingTx.txIn[0].witness![0] = signatureWithHashType as WitnessStackItem;

  const spendingTxRaw = packTx(spendingTx);
  const spendingTxRepacked = readTx(spendingTxRaw)[0];
  console.info(
    `Spending tx id `,
    Buffer.from(spendingTxRepacked.txid).reverse().toString("hex")
  );
  console.info("Spending tx raw:\n" + spendingTxRaw.toString("hex"));

  return {
    raw: spendingTxRaw,
    // To calculate txid
    parsed: spendingTxRepacked,
  };
}
