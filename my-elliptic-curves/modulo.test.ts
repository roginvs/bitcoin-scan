import { Secp256k1 } from "./curves.named";
import { modulo_inverse, modulo_power, square_root } from "./modulo";

describe("Modulo tools", () => {
  it(`modulo_power`, () =>
    expect(
      modulo_power(
        BigInt("0705151807052"),
        BigInt("1231239"),
        BigInt("15778598254603")
      )
    ).toBe(BigInt("1658228449402")));

  const p = Secp256k1.p;
  const Gx = Secp256k1.G![0];

  it(`modulo_inverse`, () =>
    expect((modulo_inverse(Gx, p) * Gx) % p).toBe(BigInt(1)));

  it(`square_root`, () => {
    const Gxroot = square_root(Gx, p);
    expect((Gxroot * Gxroot) % p).toBe(Gx);
  });
});
