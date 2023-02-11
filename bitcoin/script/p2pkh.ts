import { createPublicKey, verify } from "crypto";
import {
  asn1parse,
  create_spki_der_from_pubkey,
  repackSignature,
} from "./asn1";
import { ripemd160, sha256 } from "../utils/hashes";
import { packTx } from "../protocol/messages.create";
import { BitcoinTransaction } from "../protocol/messages.parse";
import { PkScript, SignatureScript } from "../protocol/messages.types";
import { joinBuffers } from "../utils/joinBuffer";
import { ECDSASignatureValidatedListener } from "./types";
import { compressPublicKey } from "../protocol/compressPublicKey";

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
  const signatureDer = signatureAndHashType.slice(
    0,
    signatureAndHashType.length - 1
  );
  const hashCodeType = signatureAndHashType[signatureAndHashType.length - 1];
  return {
    pubKey,
    signatureDer,
    hashCodeType,
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
  const { pubKey, signatureDer, hashCodeType } = inputScriptParsed;
  const pubkeyHashObserved = ripemd160(sha256(pubKey));
  if (!pubkeyHashExpected.equals(pubkeyHashObserved)) {
    throw new Error("Public key hashes are not equal");
  }
  if (hashCodeType !== 0x01 && hashCodeType !== 0x00) {
    console.info(`Spending tx index=${spendingIndex} txData=`);
    console.info(packTx(spending).toString("hex"));
    console.info(`pkScript =`, sourcePkScript.toString("hex"));
    throw new Error(`This hashCodeType=${hashCodeType} is not supported yet`);
  }

  const txNew: BitcoinTransaction = {
    ...spending,
    isWitness: false,
    txIn: spending.txIn.map((txIn, index) => {
      if (index !== spendingIndex) {
        return {
          ...txIn,
          script: Buffer.alloc(0) as SignatureScript,
        };
      } else {
        return {
          ...txIn,
          // We do not check OP_CODESEPARATORS here
          script: sourcePkScript as Buffer as SignatureScript,
        };
      }
    }),
  };

  const dataToVerify = sha256(
    joinBuffers(
      packTx(txNew),
      // hashTypeCode
      Buffer.from([hashCodeType, 0, 0, 0])
    )
  );

  const pub = createPublicKey({
    key: create_spki_der_from_pubkey(pubKey),
    type: "spki",
    format: "der",
  });

  const verifyResult = verify(undefined, dataToVerify, pub, signatureDer);
  if (!verifyResult) {
    {
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
    }

    const verifyResultIfSignatureRepacked = verify(
      undefined,
      dataToVerify,
      pub,
      repackSignature(signatureDer)
    );
    if (verifyResultIfSignatureRepacked) {
      // ok, just an issue with DER encoding
    } else {
      throw new Error(`Signature verification failed`);
    }
  }

  let r: Buffer;
  let s: Buffer;

  const [asn1, rest] = asn1parse(signatureDer);
  if (rest.length > 0) {
    // Well, some transactions have signatures with data after asn1
    // throw new Error(`Some data is left in asn`);
  }
  if (!Array.isArray(asn1)) {
    throw new Error(`Not an array in the asn`);
  }
  if ((asn1[0] as any).type !== "integer") {
    throw new Error(`First value is not a integer in asn`);
  }
  r = (asn1[0] as any).value;
  if (!(r instanceof Buffer)) {
    throw new Error(`Internal error: not a buffer`);
  }
  if ((asn1[1] as any).type !== "integer") {
    throw new Error(`Second value is not a integer in asn`);
  }
  s = (asn1[1] as any).value;
  if (!(r instanceof Buffer)) {
    throw new Error(`Internal error: not a buffer`);
  }

  const pubKeyCompressed = compressPublicKey(pubKey);
  if (!pubKeyCompressed) {
    throw new Error(`Failed to compress public key`);
  }

  return {
    r,
    s,
    msg: dataToVerify,
    pubKeyCompressed,
  };
}
