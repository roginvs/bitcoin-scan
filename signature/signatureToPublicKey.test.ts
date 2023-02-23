import {
  getBitcoinMessageHash,
  packVarInt,
  signatureToPublicKey,
} from "./signatureToPublicKey";

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
      pubKeyHex: {
        x: "9b095a4bf6b07821aea4e17faa67d23ab67651b0e560278554ae44f6074eb52c",
        y: "1ff0ba6dd6933e9b57da2e2ac154c42db20d103d91c21f6933b5d7cd11c0d334",
      },
      walletType: "P2PKH compressed",
    });
  });
});

describe(`signatureToPublicKey`, () => {
  it(`Sig2`, () => {
    expect(
      signatureToPublicKey(`
-----BEGIN BITCOIN SIGNED MESSAGE-----
Welcome to signature verification!
This page can verify all types of signatures
This message was signed by 19aJFYXVr9wjEm3cfQnJD
-----BEGIN BITCOIN SIGNATURE-----
Comment: Comments are supportedddd!

H0vYpepfJ9uVdkaRZf5owH3pOxyzDbKqf+WGdBadt35JAy7tCpMKOpWuSZCMvb1a8E+2v4owi872wIi3KSh/vq4=
-----END BITCOIN SIGNATURE-----        
          
          `)
    ).toStrictEqual({
      pubKeyHex: {
        x: "9b095a4bf6b07821aea4e17faa67d23ab67651b0e560278554ae44f6074eb52c",
        y: "1ff0ba6dd6933e9b57da2e2ac154c42db20d103d91c21f6933b5d7cd11c0d334",
      },
      walletType: "P2PKH compressed",
    });
  });
});

describe(`packVarInt`, () => {
  const data = [
    [0, [0]],
    [1, [1]],
    [0xfd - 1, [0xfd - 1]],
    [0xfd, [0xfd, 0xfd, 0]],
    [0xfe, [0xfd, 0xfe, 0]],
    [0xff, [0xfd, 0xff, 0]],
    [0xabcd, [0xfd, 0xcd, 0xab]],
    [0xfffe, [0xfd, 0xfe, 0xff]],
    [0xffff, [0xfe, 0xff, 0xff, 0x00, 0x00]],
    [0xaabbccdd, [0xfe, 0xdd, 0xcc, 0xbb, 0xaa]],
    [0xfffffffe, [0xfe, 0xfe, 0xff, 0xff, 0xff]],
    [0xffffffff, [0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]],
    [0xaabbccddeeff, [0xff, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x00, 0x00]],
  ] as const;
  for (const [val, expected] of data) {
    it(`val=${val}`, () => {
      expect([...packVarInt(val)]).toStrictEqual(expected);
    });
  }
});

describe(`getBitcoinMessageHash`, () => {
  const testData = [
    [
      "lol kek asdasd",
      "428d7e6d877d3ec55a0919145b760955d4f5d0b4b730d058d8cab0b98e10feed",
    ],
    [
      "AaÄäÖöÅå",
      "3f294b8905aa4de056fb445c2a3df32196669f07850bbb870052a691928128fe",
    ],
  ];
  for (const [input, expected] of testData) {
    it(`'${input}'`, () => {
      expect(Buffer.from(getBitcoinMessageHash(input)).toString("hex")).toBe(
        Buffer.from(expected, "hex").reverse().toString("hex")
      );
    });
  }
});
