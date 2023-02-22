import { readPgpLikePart } from "./parse-pgp-like";

describe("Parse PGP-like", () => {
  describe(`readPgpLikePart`, () => {
    const data1 = {
      header: "BEGIN BITCOIN SIGNED MESSAGE",
      data: "60213445ca0f7e08b16c6dd0f1172f32a0effba1c74077e408e34b54424ebeda",
      rest: `-----BEGIN BLA BLA-----   \n\n\n aaa`,
    };
    const data1raw =
      `-----BEGIN BITCOIN SIGNED MESSAGE-----\n` +
      `60213445ca0f7e08b16c6dd0f1172f32a0effba1c74077e408e34b54424ebeda\n` +
      `-----BEGIN BLA BLA-----   \n\n\n aaa`;
    it(`readPgpLikePart with \n`, () => {
      expect(readPgpLikePart(data1raw)).toStrictEqual(data1);
    });

    it(`readPgpLikePart with \r\n`, () => {
      expect(readPgpLikePart(data1raw.split("\n").join("\r\n"))).toStrictEqual({
        ...data1,
        rest: data1.rest.split("\n").join("\r\n"),
      });
    });
  });
});
