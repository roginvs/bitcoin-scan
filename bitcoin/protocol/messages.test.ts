import { genesisBlockHash } from "./consts";
import { sha256 } from "../utils/hashes";
import {
  buildMessage,
  createGetdataMessage,
  packTx,
  packVarStr,
} from "./messages.create";
import { parseMessage, readTx } from "./messages.parse";
import { HashType, MessagePayload } from "./messages.types";
import { sourceTxRaw, spendingTxRaw } from "./testdata";
import { joinBuffers } from "../utils/joinBuffer";

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

  it(`createGetdataMessage`, () => {
    const msg = createGetdataMessage([[HashType.MSG_BLOCK, genesisBlockHash]]);
    const parsed = parseMessage(msg)!;
    expect(parsed[0]).toBe("getdata");
    expect(parsed[1].toString("hex")).toBe(
      "01" + "02000000" + genesisBlockHash.toString("hex")
    );
    expect(parsed[2].length).toBe(0);
  });

  describe("Transactions", () => {
    it(`Reading`, () => {
      const [parsed1, rest1] = readTx(sourceTxRaw);
      expect(rest1.length).toBe(0);
      expect(sha256(sha256(sourceTxRaw)).reverse().toString("hex")).toBe(
        "0183bd75b61c3642bc4664a63f86acc6872045305de29722ee3e0c583483cdec"
      );
      expect(parsed1.txid.toString("hex")).toBe(
        Buffer.from(
          "0183bd75b61c3642bc4664a63f86acc6872045305de29722ee3e0c583483cdec",
          "hex"
        )
          .reverse()
          .toString("hex")
      );

      const [parsed2, rest2] = readTx(spendingTxRaw);
      expect(rest2.length).toBe(0);
      expect(parsed2.txid.toString("hex")).toBe(
        Buffer.from(
          "c30df3c03045d6b0fd2ba83a90144133b85b3fdbb8949850b7a408b852821c54",
          "hex"
        )
          .reverse()
          .toString("hex")
      );
      expect(parsed2.txIn.length).toBe(1);
      expect(parsed2.txIn[0].outpointHash.toString("hex")).toBe(
        parsed1.txid.toString("hex")
      );
    });
    it(`Packing`, () => {
      for (const txRaw of [sourceTxRaw, spendingTxRaw]) {
        const [parsed, rest] = readTx(txRaw);
        expect(rest.length).toBe(0);
        const packed = packTx(parsed);
        expect(packed.toString("hex")).toBe(txRaw.toString("hex"));
      }
    });
  });
});
