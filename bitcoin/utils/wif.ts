import { base58encode } from "./base58";
import { sha256 } from "./hashes";

export function exportPrivateKey(privKey: Buffer, isCompressed = true) {
  // https://en.bitcoin.it/wiki/Wallet_import_format
  const step2 = Buffer.concat([
    Buffer.from([0x80]),
    privKey,
    isCompressed ? Buffer.from([1]) : Buffer.from([]),
  ]);
  const hash = sha256(sha256(step2));
  const step6 = Buffer.concat([step2, hash.subarray(0, 4)]);
  return base58encode(step6);
}
