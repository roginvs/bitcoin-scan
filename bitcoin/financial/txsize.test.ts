import { TransactionPayload } from "../protocol/messages.types";
import { getTxSize } from "./txsize";

describe(`Get tx size`, () => {
  it(`Demo tx`, () => {
    const demoTx = Buffer.from(
      "0200000000010150a75d1afee925231f3935b18771e6881fda318ae600aa3fcc198f9a50758f7e0000000000f0ffffff08a546800b00000000160014015f524f21a6d8e0c8cdf9338467814294dd9fbbb3a50000000000001600149cfad00d405130ea4e8a4d5d381a5c8a4642fa2efc190000000000001600147746ba2bf1b68f20b4e8570a5b8290cfbab8f5170cfc0000000000001600145bb3acb75c375f2e84b4f3f43aac2dc888694003ab1a0600000000001600146baaf89139f2698ca57286d53045fc0952ea95569d131e000000000017a91479f3633e04838a5770277951ee15208d01063dd287b8860000000000001600140e257d3f18e6f5df6339206cd03ef1d64b4d76195ea9000000000000160014ed360bf8eb3f229db2e371a9324f6ba47daf660b02483045022100d11536ef97aeb160db58210804d18045e687ff38d44733ba035a057b68f6745902201fb9630c5a1e9a6dd65578517c71f8e4e7254b17434639e65c56f6203db89cbd012103e0ebb9dd2a9314f16c76a0c68ea4dd2355033f95a3294b01eaf1f6aa1aaaa3fd00000000",
      "hex"
    ) as TransactionPayload;
    expect(getTxSize(demoTx)).toStrictEqual({
      //size is demoTx.length,
      size: 410,
      weight: 1310,
      vbytes: Math.ceil(327.5),
    });
  });

  it(`Demo tx 2`, () => {
    const demoTx = Buffer.from(
      `0100000000010115e180dc28a2327e687facc33f10f2a20da717e5548406f7ae8b4c8
      11072f85603000000171600141d7cd6c75c2e86f4cbf98eaed221b30bd9a0b928ffff
      ffff019caef505000000001976a9141d7cd6c75c2e86f4cbf98eaed221b30bd9a0b92
      888ac02483045022100f764287d3e99b1474da9bec7f7ed236d6c81e793b20c4b5aa1
      f3051b9a7daa63022016a198031d5554dbb855bdbe8534776a4be6958bd8d530dc001
      c32b828f6f0ab0121038262a6c6cec93c2d3ecd6c6072efea86d02ff8e3328bbd0242
      b20af3425990ac00000000`
        .split("\n")
        .join("")
        .replace(/\s+/g, ""),
      "hex"
    ) as TransactionPayload;
    expect(getTxSize(demoTx)).toStrictEqual({
      //size is demoTx.length,
      size: 218,
      weight: 542,
      vbytes: Math.ceil(135.5),
    });
  });
});
