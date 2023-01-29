import { PkScript } from "./messages.types";

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
