import { packHashCodeType, readHashCodeType } from "./hashCode";

describe("Pack and unpack hash code type", () => {
  for (const i of [0, 1, 2, 3, 4, 0x80, 0x81, 0x82, 0x83, 0x84]) {
    it(`Code = ${i}`, () => {
      const parsed = readHashCodeType(i);
      expect(parsed).toStrictEqual(readHashCodeType(packHashCodeType(parsed)));
    });
  }
});
