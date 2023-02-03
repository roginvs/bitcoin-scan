import { modulo_power_point } from "./curves";
import { p256 } from "./curves.named";
import {
  check_signature,
  get_private_key_if_diff_k_is_known,
  get_private_key_if_diff_k_is_known_verified,
  recover_public_key,
  signature,
} from "./ecdsa";

describe("ECDSA with NIST P-256", () => {
  const curve = p256;

  const privateKey = BigInt(
    "0xC9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721"
  );
  const publicKey = modulo_power_point(curve.G, privateKey, curve.a, curve.p);

  const msgHash = BigInt(
    "0xaf2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf"
  );
  const r = BigInt(
    "0xEFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716"
  );
  const s = BigInt(
    "0xf7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8"
  );

  it(`Signature`, () => {
    expect(
      signature({
        curve,
        privateKey,
        msgHash,
        k: BigInt(
          "0xA6E3C57DD01ABE90086538398355DD4C3B17AA873382B0F24D6129493D8AAD60"
        ),
      })
    ).toStrictEqual({
      r,
      s,
    });
  });

  describe("Check signature", () => {
    it("Inf", () =>
      expect(
        check_signature({
          curve,
          publicKey: null,
          msgHash: BigInt(0),
          r: BigInt(0),
          s: BigInt(0),
        })
      ).toBe(false));

    it("Valid", () =>
      expect(
        check_signature({
          curve,
          publicKey,
          msgHash,
          r,
          s,
        })
      ).toBe(true));

    it("Not valid", () =>
      expect(
        check_signature({
          curve,
          publicKey,
          msgHash,
          r,
          s: s + BigInt(1),
        })
      ).toBe(false));
  });

  describe(`Deriving private key`, () => {
    const k = BigInt(
      "0xA6E3C57DD01ABE90086538398355DD4C3B17AA873382B0F24D6129493D8AAD60"
    );
    const msgHash1 = BigInt(
      "0xaf2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf"
    );
    const msgHash2 = BigInt(
      "0x287e55fbb32310b21980e590103b0dfca3aea9921eeea943686866e16a5122cf"
    );
    const sig1 = signature({
      curve,
      privateKey,
      msgHash: msgHash1,
      k,
    });

    describe(`get_private_key_if_diff_k_is_known`, () => {
      for (const kDiff of [undefined, BigInt(0), BigInt(1), BigInt(100)]) {
        it(` kDiff = ${
          kDiff !== undefined ? kDiff.toString(10) : `<same>`
        }`, () => {
          const sig2 = signature({
            curve,
            privateKey,
            msgHash: msgHash2,
            k: k + (kDiff || BigInt(0)),
          });

          const recoveredPrivateKey = get_private_key_if_diff_k_is_known(
            curve,
            sig1,
            msgHash1,
            sig2,
            msgHash2,
            kDiff
          );

          expect(recoveredPrivateKey).toBe(privateKey);
        });
      }
    });

    describe(`get_private_key_if_diff_k_is_known_verified`, () => {
      for (const kDiff of [undefined, BigInt(0), BigInt(3)]) {
        for (const [invA, invB] of [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
        ]) {
          it(`kDiff=${kDiff ?? "<same>"} Sig1=${!!invA} Sig2=${!!invB}`, () => {
            const sig2 = signature({
              curve,
              privateKey,
              msgHash: msgHash2,
              k: k + (kDiff || BigInt(0)),
            });

            const expectedPrivateKey =
              get_private_key_if_diff_k_is_known_verified(
                curve,
                publicKey,
                sig1,
                msgHash1,
                sig2,
                msgHash2,
                kDiff
              );

            expect(expectedPrivateKey).toBe(privateKey);
          });
        }
      }
    });
  });

  it(`Signature is valid if s is negative s`, () => {
    expect(
      check_signature({
        curve,
        publicKey,
        msgHash,
        r,
        s: s,
      })
    ).toBe(true);

    expect(
      check_signature({
        curve,
        publicKey,
        msgHash,
        r,
        s: curve.n - s,
      })
    ).toBe(true);
  });

  it(`recover_public_key`, () => {
    const possiblePublicKeys = recover_public_key(curve, r, s, msgHash);
    expect(possiblePublicKeys).toContainEqual(publicKey);
  });
});
