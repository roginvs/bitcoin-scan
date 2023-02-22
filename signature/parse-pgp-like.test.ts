import { readPgpLikePart } from "./parse-pgp-like";

describe("Parse PGP-like", () => {
  describe(`Replace <LF> with <CL RF> (as in RFC)`, () => {
    const data1raw =
      `-----BEGIN BITCOIN SIGNED MESSAGE-----\n` +
      `Comment: this is comment\n\n` +
      `boooooo\n  kokoko\r\ntreeee\n- ---rrrrraaaaaaabbb\n` +
      `-----BEGIN BLA BLA-----   \n\n\n aaa`;

    const parsed = {
      header: "BEGIN BITCOIN SIGNED MESSAGE",
      data: "boooooo\r\n  kokoko\r\ntreeee\r\n---rrrrraaaaaaabbb",
      rest: `-----BEGIN BLA BLA-----   \n\n\n aaa`,
      headers: {
        Comment: "this is comment",
      },
    };

    it(`readPgpLikePart with \\n`, () => {
      expect(readPgpLikePart(data1raw, true, ["Comment"])).toStrictEqual(
        parsed
      );
    });

    it(`readPgpLikePart with spaces in the beginning`, () => {
      expect(
        readPgpLikePart("   \n  \r\n   " + data1raw, true, ["Comment"])
      ).toStrictEqual(parsed);
    });
  });
});
