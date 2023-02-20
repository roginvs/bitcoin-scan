import { padMessage, rightrotate, rightshift, sha256 } from "./sha256";

describe("sha256 functions", () => {
  it(`padMessage asd`, () => {
    const binary = new Uint8Array(padMessage(Buffer.from("abc")));
    expect(binary[0]).toBe(0b01100001);
    expect(binary[1]).toBe(0b01100010);
    expect(binary[2]).toBe(0b01100011);
    expect(binary[3]).toBe(0b10000000);
    for (let i = 4; i < 63; i++) {
      expect(binary[i]).toBe(0);
    }
    expect(binary[63]).toBe(0x18);
    expect(binary.length).toBe(64);
  });
  describe.skip("sha256", () => {
    it("asd", () => {
      expect(Buffer.from(sha256(Buffer.from("abc"))).toString("hex")).toBe(
        "asd"
      );
    });
  });

  const rotateShiftTestData = [
    [0xaabbccdd, 8],
    [0xaabbccdd, 0],
    [0xaabbccdd, 32],
    [0x00000001, 1],
    [0xaabbccdd, 14],
    [0xf231bc1f, 31],
  ];

  describe("rightrotate", () => {
    function rightrotate_string(n: number, bits: number) {
      const nStr = ("0".repeat(32) + n.toString(2)).slice(-32);
      const nStrRotated = bits
        ? nStr.slice(-bits) + nStr.slice(0, 32 - bits)
        : nStr;
      const int = parseInt(nStrRotated, 2);
      return int;
    }
    for (const [n, bits] of rotateShiftTestData) {
      it(`rightrotate ${n} >> ${bits}`, () => {
        expect(rightrotate(n, bits)).toBe(rightrotate_string(n, bits));
      });
    }
  });

  describe("rightshift", () => {
    function rightshift_string(n: number, bits: number) {
      const nStr = ("0".repeat(32) + n.toString(2)).slice(-32);
      const nStrRotated = nStr.slice(0, 32 - bits);
      const int = parseInt("0" + nStrRotated, 2);
      return int;
    }
    for (const [n, bits] of rotateShiftTestData) {
      it(`rightshift ${n} >> ${bits}`, () => {
        expect(rightshift(n, bits)).toBe(rightshift_string(n, bits));
      });
    }
  });
});
