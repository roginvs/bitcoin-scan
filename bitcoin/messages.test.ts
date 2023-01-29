import { buildMessage, joinBuffers, packVarStr } from "./messages";
import { MessagePayload } from "./messages.types";

function bufFromStr(str: string) {
  return Buffer.from(
    str
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l)
      .map((l) => l.split("-")[0])
      .map((l) => l.replace(/\s/g, ""))
      .join(""),
    "hex"
  );
}
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

  it(`Buf from str`, () => {
    expect(
      bufFromStr(
        `
            01                                              - 1 address in this message         
            E2 15 10 4D                                     - Mon Dec 20 21:50:10 EST 2010 (only when version is >= 31402)
            01 00 00 00 00 00 00 00                         - 1 (NODE_NETWORK service - see version message)
            00 00 00 00 00 00 00 00 00 00 FF FF 0A 00 00 01 - IPv4: 10.0.0.1, IPv6: ::ffff:10.0.0.1 (IPv4-mapped IPv6 address)
            20 8D                                           - port 8333 `
      ).toString("hex")
    ).toBe("01e215104d010000000000000000000000000000000000ffff0a000001208d");
  });
  it(`Build message`, () => {
    expect(
      buildMessage(
        "addr",
        Buffer.from(
          bufFromStr(`
          01                                              - 1 address in this message         
          E2 15 10 4D                                     - Mon Dec 20 21:50:10 EST 2010 (only when version is >= 31402)
          01 00 00 00 00 00 00 00                         - 1 (NODE_NETWORK service - see version message)
          00 00 00 00 00 00 00 00 00 00 FF FF 0A 00 00 01 - IPv4: 10.0.0.1, IPv6: ::ffff:10.0.0.1 (IPv4-mapped IPv6 address)
          20 8D                                           - port 8333 `)
        ) as MessagePayload
      ).toString("hex")
    ).toBe(
      bufFromStr(`
        F9 BE B4 D9 61 64 64 72  00 00 00 00 00 00 00 00   
        1F 00 00 00 ED 52 39 9B  01 E2 15 10 4D 01 00 00   
        00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 FF   
        FF 0A 00 00 01 20 8D  
        `).toString("hex")
    );
  });

  it(`packVarStr`, () => {
    expect(packVarStr("").toString("hex")).toBe("00");
    expect(packVarStr("/Satoshi:0.7.2/").toString("hex").toUpperCase()).toBe(
      "0F 2F 53 61 74 6F 73 68 69 3A 30 2E 37 2E 32 2F".replace(/ /g, "")
    );
  });
});
