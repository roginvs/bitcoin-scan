import {
  CurveParams,
  get_point_from_x,
  get_point_inverse,
  is_on_curve,
  Point,
} from "./curves";

export function uncompressPublicKey(
  curve: CurveParams,
  publicKey: Buffer
): Point {
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
  } else if (first === 0x02 || first === 0x03) {
    if (publicKey.length !== 32 + 1) {
      throw new Error(`Wrong length!`);
    }
    const point = get_point_from_x(
      BigInt("0x" + publicKey.subarray(1, 1 + 32).toString("hex")),
      curve.a,
      curve.b,
      curve.p
    );
    if (!point) {
      return point;
    }
    const isEven = point[1] % BigInt(2) === BigInt(0);
    if ((first === 0x02 && !isEven) || (first === 0x03 && isEven)) {
      return get_point_inverse(point, curve.p);
    } else {
      return point;
    }
  } else {
    throw new Error(`Unknown ${first}`);
  }
}
