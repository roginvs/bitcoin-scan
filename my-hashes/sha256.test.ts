import { padMessage } from "./sha256";

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
});
