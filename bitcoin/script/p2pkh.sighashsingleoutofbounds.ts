import { Secp256k1 } from "../../my-elliptic-curves/curves.named";
import { check_signature } from "../../my-elliptic-curves/ecdsa";
import { uncompressPublicKey } from "../../my-elliptic-curves/uncompressPublicKey";
import { extract_sig_r_and_s_from_der } from "./extract_sig_r_and_s_from_der";

export const msgHashIfSighashIsOutOfBounds = Buffer.from(
  "0100000000000000000000000000000000000000000000000000000000000000",
  "hex"
);

const msgHashIfSighashIsOutOfBoundsInt = BigInt(
  "0x" + msgHashIfSighashIsOutOfBounds.toString("hex")
);

export function verifySignatureIfSighashSingleIsOutOfBounds(
  publicKey: Buffer,
  signatureDer: Buffer
) {
  let r, s;
  try {
    [r, s] = extract_sig_r_and_s_from_der(signatureDer);
  } catch (e) {
    return false;
  }
  const result = check_signature({
    curve: Secp256k1,
    msgHash: msgHashIfSighashIsOutOfBoundsInt,
    publicKey: uncompressPublicKey(Secp256k1, publicKey),
    r: BigInt("0x" + r.toString("hex")),
    s: BigInt("0x" + s.toString("hex")),
  });
  return result;
}
