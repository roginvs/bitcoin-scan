import { createPublicKey, verify } from "crypto";
import { create_spki_der_from_pubkey, repackSignature } from "./asn1";
import { ripemd160, sha256 } from "../utils/hashes";
import { packTx } from "../protocol/messages.create";
import { BitcoinTransaction } from "../protocol/messages.parse";
import { PkScript, SignatureScript } from "../protocol/messages.types";
import { joinBuffers } from "../utils/joinBuffer";
import { compressPublicKey } from "../protocol/compressPublicKey";
import { extract_sig_r_and_s_from_der } from "./extract_sig_r_and_s_from_der";
import {
  msgHashIfSighashIsOutOfBounds,
  verifySignatureIfSighashSingleIsOutOfBounds,
} from "./p2pkh.sighashsingleoutofbounds";
import {
  getOpChecksigSignatureValue,
  readHashCodeType,
} from "./op_checksig_sig_value";

export function isSourceScriptP2PKH(sourcePkScript: PkScript) {
  if (sourcePkScript.length !== 0x14 + 5) {
    return "wrong len";
  }
  if (sourcePkScript[0] !== 0x76) {
    return "first command is not OP_DUP";
  }
  if (sourcePkScript[1] !== 0xa9) {
    return "second command is not OP_HASH160";
  }
  if (sourcePkScript[2 + 1 + 0x14 + 0] !== 0x88) {
    return "no OP_EQUALVERIFY command";
  }
  if (sourcePkScript[2 + 1 + 0x14 + 1] !== 0xac) {
    return "no OP_CHECKSIG command";
  }
  const pubkeyHash = sourcePkScript.subarray(3, 3 + 0x14);
  return pubkeyHash;
}

export function isSignatureScriptLooksLikeP2PKH(inputScript: SignatureScript) {
  const signatureAndHashTypeLen = inputScript[0];
  if (signatureAndHashTypeLen < 0x01 || signatureAndHashTypeLen > 0x4b) {
    return "input script first is not push to stack";
  }
  if (inputScript.length < signatureAndHashTypeLen + 1) {
    return "not enough length for signature";
  }
  const signatureAndHashType = inputScript.subarray(
    1,
    1 + signatureAndHashTypeLen
  );
  const pubkeyLen = inputScript[1 + signatureAndHashTypeLen];
  if (pubkeyLen < 0x01 || pubkeyLen > 0x4b) {
    return "input script second command is not push to stack";
  }
  if (inputScript.length < 1 + signatureAndHashTypeLen + 1 + pubkeyLen) {
    return "not enough len for pubkey";
  }
  const pubKey = inputScript.subarray(
    1 + signatureAndHashTypeLen + 1,
    1 + signatureAndHashTypeLen + 1 + pubkeyLen
  );
  if (inputScript.length !== 1 + signatureAndHashTypeLen + 1 + pubkeyLen) {
    return "some data is left on input script";
  }
  const signatureDer = signatureAndHashType.subarray(
    0,
    signatureAndHashType.length - 1
  );
  const hashCodeTypeNumber =
    signatureAndHashType[signatureAndHashType.length - 1];
  return {
    pubKey,
    signatureDer,
    hashCodeTypeNumber,
  };
}

/**
 * If not a P2PKH returns string with description
 * If is a P2PKH then it throws if signature is not valid
 */
export function check_P2PKH(
  spending: BitcoinTransaction,
  spendingIndex: number,
  sourcePkScript: PkScript
) {
  const pubkeyHashExpected = isSourceScriptP2PKH(sourcePkScript);
  if (typeof pubkeyHashExpected === "string") {
    return pubkeyHashExpected;
  }
  const inputScript = spending.txIn[spendingIndex].script;
  const inputScriptParsed = isSignatureScriptLooksLikeP2PKH(inputScript);
  if (typeof inputScriptParsed === "string") {
    return inputScriptParsed;
  }
  const { pubKey, signatureDer, hashCodeTypeNumber } = inputScriptParsed;
  const pubkeyHashObserved = ripemd160(sha256(pubKey));
  if (!pubkeyHashExpected.equals(pubkeyHashObserved)) {
    throw new Error("Public key hashes are not equal");
  }

  const pub = createPublicKey({
    key: create_spki_der_from_pubkey(pubKey),
    type: "spki",
    format: "der",
  });

  const [r, s] = extract_sig_r_and_s_from_der(signatureDer);

  const pubKeyCompressed = compressPublicKey(pubKey);
  if (!pubKeyCompressed) {
    throw new Error(`Failed to compress public key`);
  }

  const hashCodeType = readHashCodeType(hashCodeTypeNumber);
  const isSigHashSingleOutputOutOfBounds =
    hashCodeType.isSigHashSingle && spendingIndex >= spending.txOut.length;

  if (isSigHashSingleOutputOutOfBounds) {
    const verifyResult = verifySignatureIfSighashSingleIsOutOfBounds(
      pubKey,
      signatureDer
    );
    if (!verifyResult) {
      throw new Error(`SIGHASH_SINGLE out-of-bounds and still wrong signature`);
    }
    return {
      r,
      s,
      // TODO: We save messages but it is enough to save hashes. Change to save hashes
      msg: msgHashIfSighashIsOutOfBounds,
      pubKeyCompressed,
    };
  }

  const dataToVerify = getOpChecksigSignatureValue(
    spending,
    spendingIndex,
    sourcePkScript,
    hashCodeTypeNumber
  );

  const verifyResult = verify(undefined, dataToVerify, pub, signatureDer);
  if (verifyResult) {
    return {
      r,
      s,
      msg: dataToVerify,
      pubKeyCompressed,
    };
  }

  /*
      // This is an example how to verify using openssl command line tool

      fs.writeFileSync("tmp/data", dataToVerify);
      fs.writeFileSync("tmp/pubkey", create_spki_der_from_pubkey(pubKey));

      // This will fail
      // openssl dgst -verify pubkey -signature sig1 -keyform der data
      fs.writeFileSync("tmp/sig1", signatureDer);

      // This passes
      // openssl dgst -verify pubkey -signature sig2 -keyform der data
      fs.writeFileSync("tmp/sig2", repackSignature(signatureDer));
      */

  const verifyResultIfSignatureRepacked = verify(
    undefined,
    dataToVerify,
    pub,
    repackSignature(signatureDer)
  );
  if (verifyResultIfSignatureRepacked) {
    return {
      r,
      s,
      msg: dataToVerify,
      pubKeyCompressed,
    };
  }

  console.info(hashCodeType);
  console.info(
    `isSigHashSingleOutputOutOfBounds=${isSigHashSingleOutputOutOfBounds}`
  );

  console.info(`spendingIndex=${spendingIndex} `);
  console.info(
    `Spending tx id = ` + Buffer.from(spending.txid).reverse().toString("hex")
  );
  console.info(packTx(spending).toString("hex"));
  console.info(`pkScript =`, sourcePkScript.toString("hex"));
  throw new Error(`Signature verification failed`);
}
