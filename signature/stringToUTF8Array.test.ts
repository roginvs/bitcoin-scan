import { stringToUTF8Array } from "./stringToUTF8Array";

describe(`stringToUTF8Array`, () => {
  const testStrings = ["asd", "ФФ", "öaäö ", "नमस्ते"];
  for (const s of testStrings) {
    it(`${s}`, () => {
      expect(Buffer.from(stringToUTF8Array(s)).toString("hex")).toBe(
        Buffer.from(s).toString("hex")
      );
    });
  }
});
