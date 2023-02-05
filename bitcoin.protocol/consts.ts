import { BlockHash } from "./messages.types";

export const protocolVersion = Buffer.from("62EA0000", "hex");
export const bitcoinMessageMagic = Buffer.from("F9BEB4D9", "hex");

const realGenesisHash = Buffer.from(
  "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
  "hex"
).reverse() as BlockHash;

// Just for debugging
const fakeGenesisHash = Buffer.from(
  "00000000000000000005f883a624ff0896bdfaa2020630b5e98d400fba5d0972",
  "hex"
).reverse() as BlockHash;

export const genesisBlockHash = realGenesisHash;
