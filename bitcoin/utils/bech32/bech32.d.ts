export type Encoding = "bech32" | "bech32m";

export function encode(hrp: string, data: number[], encoding: Encoding): string;
export function decode(
  bechString: string,
  encoding: Encoding
): {
  hrp: string;
  data: number[];
} | null;
