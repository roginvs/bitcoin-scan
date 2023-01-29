import { PkScript, SignatureScript } from "./messages.types";

export function isSourceScriptP2PKH(sourcePkScript: PkScript) {
  if (sourcePkScript.length !== 0x14 + 5) {
    // "wrong len";
    return null;
  }
  if (sourcePkScript[0] !== 0x76) {
    // "first command is not OP_DUP";
    return null;
  }
  if (sourcePkScript[1] !== 0xa9) {
    // "second command is not OP_HASH160";
    return null;
  }
  if (sourcePkScript[2 + 1 + 0x14 + 0] !== 0x88) {
    // "no OP_EQUALVERIFY command";
    return null;
  }
  if (sourcePkScript[2 + 1 + 0x14 + 1] !== 0xac) {
    // "no OP_CHECKSIG command";
    return null;
  }
  const pubkeyHash = sourcePkScript.subarray(3, 3 + 0x14);
  return pubkeyHash;
}

export function isSignatureScriptLooksLikeP2PKH(inputScript: SignatureScript) {
  const signatureAndHashTypeLen = inputScript[0];
  if (signatureAndHashTypeLen < 0x01 || signatureAndHashTypeLen > 0x4b) {
    // "input script first is not push to stack";
    return null;
  }
  if (inputScript.length < signatureAndHashTypeLen + 1) {
    // "not enough length for signature";
    return null;
  }
  const signatureAndHashType = inputScript.subarray(
    1,
    1 + signatureAndHashTypeLen
  );
  const pubkeyLen = inputScript[1 + signatureAndHashTypeLen];
  if (pubkeyLen < 0x01 || pubkeyLen > 0x4b) {
    // "input script second command is not push to stack";
    return null;
  }
  if (inputScript.length < 1 + signatureAndHashTypeLen + 1 + pubkeyLen) {
    // "not enough len for pubkey";
    return null;
  }
  const pubKey = inputScript.subarray(
    1 + signatureAndHashTypeLen + 1,
    1 + signatureAndHashTypeLen + 1 + pubkeyLen
  );
  if (inputScript.length !== 1 + signatureAndHashTypeLen + 1 + pubkeyLen) {
    // "some data is left on input script";
    return null;
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
