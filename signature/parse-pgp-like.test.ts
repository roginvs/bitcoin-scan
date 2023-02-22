import { readPgpLikePart } from "./parse-pgp-like";

describe("Parse PGP-like", () => {
  describe(`Single line`, () => {
    const data1raw =
      `-----BEGIN BITCOIN SIGNED MESSAGE-----\n` +
      `60213445ca0f7e08b16c6dd0f117\n  2f32a0effba1c74077e408e34b54424ebeda\n` +
      `-----BEGIN BLA BLA-----   \n\n\n aaa`;

    const parsed = {
      header: "BEGIN BITCOIN SIGNED MESSAGE",
      data: "60213445ca0f7e08b16c6dd0f117\r\n  2f32a0effba1c74077e408e34b54424ebeda",
      rest: `-----BEGIN BLA BLA-----   \n\n\n aaa`,
    };

    it(`readPgpLikePart with \\n`, () => {
      expect(readPgpLikePart(data1raw)).toStrictEqual(parsed);
    });

    it(`readPgpLikePart with \\r\\n`, () => {
      expect(readPgpLikePart(data1raw.split("\n").join("\r\n"))).toStrictEqual({
        header: parsed.header,
        data: parsed.data,
        rest: parsed.rest.split("\n").join("\r\n"),
      });
    });

    it(`readPgpLikePart with spaces in the beginning`, () => {
      expect(readPgpLikePart("   \n  \r\n   " + data1raw)).toStrictEqual(
        parsed
      );
    });
  });
});
