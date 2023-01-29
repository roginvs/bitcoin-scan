import { ripemd160, sha256 } from "./hashes";

describe("Bitcoin hashes", () => {
  it(`sha256`, () => {
    // Kind of check that we are using crypto library correctly
    expect(sha256(Buffer.from("hello")).toString("hex")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
    expect(sha256(sha256(Buffer.from("hello"))).toString("hex")).toBe(
      "9595c9df90075148eb06860365df33584b75bff782a510c6cd4883a419833d50"
    );
  });
  it(`RIPEMD-160`, () => {
    expect(
      ripemd160(
        Buffer.from(
          "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
          "hex"
        )
      ).toString("hex")
    ).toBe("b6a9c8c230722b7c748331a8b450f05566dc7d0f");
  });
});
