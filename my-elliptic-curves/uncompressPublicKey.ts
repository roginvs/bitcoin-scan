import { CurveParams, is_on_curve } from "./curves";

export function uncompressPublicKey(curve: CurveParams, publicKey: Buffer) {
  const first = publicKey[0];
  if (first === 0x04) {
    if (publicKey.length !== 32 + 32 + 1) {
      throw new Error(`Wrong length!`);
    }
    const x = BigInt("0x" + publicKey.subarray(1, 1 + 32).toString("hex"));
    const y = BigInt(
      "0x" + publicKey.subarray(1 + 32, 1 + 32 + 32).toString("hex")
    );
    if (!is_on_curve([x, y], curve.a, curve.b, curve.p)) {
      throw new Error(`Not on the curve`);
    }
    return [x, y];
  } else {
    throw new Error(`Unknown ${first}`);
  }
}
