import { signatureToPublicKey } from "./signatureToPublicKey";

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
