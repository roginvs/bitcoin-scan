import { exportPrivateKey } from "./wif";

describe(`exportPrivateKey`, () => {
  it(`0C28FCA386C7A227600B2FE50B7CAE11EC86D3BF1FBE471BE89827E19D72AA1D`, () => {
    expect(
      exportPrivateKey(
        Buffer.from(
          "0C28FCA386C7A227600B2FE50B7CAE11EC86D3BF1FBE471BE89827E19D72AA1D",
          "hex"
        ),
        false
      )
    ).toBe("5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ");
  });
});
