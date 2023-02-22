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

  it(`Keep <LF> as it is`, () => {
    const dataRaw =
      `-----BEGIN BITCOIN SIGNATURE-----\n` +
      `Version: Bitcoin-qt (1.0)\n` +
      `Address: 1GgszPQqCFqZrU9C6h7AUBbwrH73XGoDXU\n` +
      `\n` +
      `blabla\nbla\nlol\r\nkek\n` +
      `-----END BITCOIN SIGNATURE-----\n` +
      "a\r\nb\n";
    expect(
      readPgpLikePart(dataRaw, false, ["Address", "Version"])
    ).toStrictEqual({
      header: "BEGIN BITCOIN SIGNATURE",
      data: `blabla\nbla\nlol\r\nkek`,
      rest: `-----END BITCOIN SIGNATURE-----\n` + "a\r\nb\n",
      headers: {
        Address: "1GgszPQqCFqZrU9C6h7AUBbwrH73XGoDXU",
        Version: "Bitcoin-qt (1.0)",
      },
    });
  });
});
