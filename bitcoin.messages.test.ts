import { joinBuffers } from "./bitcoin.messages";

describe("Bitcoin messages", () => {
  it(`Join buffers`, () =>
    expect(
      joinBuffers(
        Buffer.from("AABB", "hex"),
        Buffer.from("CC", "hex"),
        Buffer.from("DDEE", "hex")
      )
        .toString("hex")
        .toUpperCase()
    ).toBe("AABBCCDDEE"));
});
