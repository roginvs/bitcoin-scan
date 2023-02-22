import { packVarInt, signatureToPublicKey } from "./signatureToPublicKey";

describe(`signatureToPublicKey`, () => {
  it(`Sig1`, () => {
    expect(
      signatureToPublicKey(`
-----BEGIN BITCOIN SIGNED MESSAGE-----
lol kek asdasd
-----BEGIN BITCOIN SIGNATURE-----
ILTEzkSmm6R9ElES2zSbclDyej7J2kc3SQzwMINw4xlMcTIXHUL6d07/Vp3rL83OXTEE4GepulkfdxYCCg5eNBI=
-----END BITCOIN SIGNATURE-----        
        
        `)
    ).toStrictEqual({
      pubXHex:
        "9b095a4bf6b07821aea4e17faa67d23ab67651b0e560278554ae44f6074eb52c",
      pubYHex:
        "1ff0ba6dd6933e9b57da2e2ac154c42db20d103d91c21f6933b5d7cd11c0d334",
    });
  });
});

describe(`packVarInt`, () => {
  const data = [
    [0, String.fromCharCode(0)],
    [1, String.fromCharCode(1)],
    [0xfd - 1, String.fromCharCode(0xfd - 1)],
    [0xfd, String.fromCharCode(0xfd, 0xfd, 0)],
    [0xfe, String.fromCharCode(0xfd, 0xfe, 0)],
    [0xff, String.fromCharCode(0xfd, 0xff, 0)],
    [0xabcd, String.fromCharCode(0xfd, 0xcd, 0xab)],
    [0xfffe, String.fromCharCode(0xfd, 0xfe, 0xff)],
    [0xffff, String.fromCharCode(0xfe, 0xff, 0xff, 0x00, 0x00)],
    [0xaabbccdd, String.fromCharCode(0xfe, 0xdd, 0xcc, 0xbb, 0xaa)],
    [0xfffffffe, String.fromCharCode(0xfe, 0xfe, 0xff, 0xff, 0xff)],
    [
      0xffffffff,
      String.fromCharCode(0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00),
    ],
    [
      0xaabbccddeeff,
      String.fromCharCode(0xff, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x00, 0x00),
    ],
  ] as const;
  for (const [val, expected] of data) {
    it(`val=${val}`, () => {
      expect(packVarInt(val)).toBe(expected);
    });
  }
});
