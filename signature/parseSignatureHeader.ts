export type SignatureWalletType =
  | "P2PKH uncompressed"
  | "P2PKH compressed"
  | "Segwit P2SH"
  | "Segwit Bech32";
export function parseSignatureHeader(n: number): {
  walletType: SignatureWalletType;
  recId: number;
} | null {
  if (n >= 27 && n <= 30) {
    return {
      walletType: "P2PKH uncompressed",
      recId: n - 27,
    };
  } else if (n >= 31 && n <= 34) {
    return {
      walletType: "P2PKH compressed",
      recId: n - 31,
    };
  } else if (n >= 35 && n <= 38) {
    return {
      walletType: "Segwit P2SH",
      recId: n - 35,
    };
  } else if (n >= 39 && n <= 42) {
    return {
      walletType: "Segwit Bech32",
      recId: n - 39,
    };
  } else {
    return null;
  }
}
