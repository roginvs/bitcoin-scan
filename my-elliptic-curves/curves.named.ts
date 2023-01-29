import { CurveParams } from "./curves";

export const Secp256k1: CurveParams = {
  p: BigInt(
    `0x` +
      `FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFFC2F`.replace(
        / /g,
        ""
      )
  ),
  a: BigInt("0x0"),
  b: BigInt("0x7"),
  G: [
    BigInt(
      "0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798"
    ),
    BigInt(
      "0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8"
    ),
  ],
  n: BigInt(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"
  ),
};

export const p256: CurveParams = {
  p: BigInt(
    "0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"
  ),
  a: BigInt(
    "0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"
  ),
  b: BigInt(
    "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"
  ),
  G: [
    BigInt(
      "0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"
    ),
    BigInt(
      "0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
    ),
  ],
  n: BigInt(
    "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"
  ),
} as const;
