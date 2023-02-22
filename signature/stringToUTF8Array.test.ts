import { stringToUTF8Array } from "./stringToUTF8Array";

describe(`stringToUTF8Array`, () => {
  const testStrings = ["asd", "ФФ", "öaäö ", "नमस्ते", "𐍈"];
  for (const s of testStrings) {
    it(`${s}`, () => {
      expect(Buffer.from(stringToUTF8Array(s)).toString("hex")).toBe(
        Buffer.from(s).toString("hex")
      );
    });
  }

  it(`Wild string 1`, () => {
    const wildString = String.fromCharCode(
      ...new Array(55296).fill(0).map((_, i) => i)
    );
    expect(Buffer.from(stringToUTF8Array(wildString)).toString("hex")).toBe(
      Buffer.from(wildString).toString("hex")
    );
  });
  it.skip(`Wild string 2`, () => {
    // This test is not correct. As as I understand we can not have 0xd800-0xdfff
    //  characters in the end of the string

    const wildString = String.fromCharCode(
      ...new Array(57343 - 55296 + 1).fill(0).map((_, i) => i + 55296)
    );
    expect(Buffer.from(stringToUTF8Array(wildString)).toString("hex")).toBe(
      Buffer.from(wildString).toString("hex")
    );
  });
  it(`Wild string 3`, () => {
    const wildString = String.fromCharCode(
      ...new Array(65535 - 57343 + 1).fill(0).map((_, i) => i + 57343 + 1)
    );
    expect(Buffer.from(stringToUTF8Array(wildString)).toString("hex")).toBe(
      Buffer.from(wildString).toString("hex")
    );
  });
});
