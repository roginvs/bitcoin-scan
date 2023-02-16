export function decode(
  hrp: string,
  addr: string
): null | { version: number; program: number[] };

export function encode(hrp: string, version: number, program: number[]): string;
