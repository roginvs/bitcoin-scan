import { createSignaturesAnalyzerStorage } from "./database/scanner.database";
import { createLogger } from "../logger/logger";
import { derivePrivateKeyFromPair } from "../crypto/keyDerive";
import { ECDSASignatureInfo } from "../bitcoin/script/types";
const { info, warn, debug } = createLogger("SCANNER");

export function createSignaturesAnalyzer(isMemory: boolean = false) {
  const storage = createSignaturesAnalyzerStorage(isMemory);

  let signaturesSaved = 0;
  let keysFound = 0;

  function ecdsaSignature(sigInfo: ECDSASignatureInfo) {
    const signaturesWithSameR = storage.getSignatures(
      sigInfo.pubKeyCompressed,
      sigInfo.r
    );
    if (
      signaturesWithSameR.some((valuesInDb) => valuesInDb.s.equals(sigInfo.s))
    ) {
      // Ok, we already have data with such compressed_public_key,r,s
      // Probably because we check the same transaction once again, for example after restart
      return;
    }

    if (
      signaturesWithSameR.length > 0 &&
      !storage.doWeHavePrivateKeyForThisPubKey(sigInfo.pubKeyCompressed)
    ) {
      // It definitely will be another r because we checked it above
      const anotherSig = signaturesWithSameR[0];

      const key = derivePrivateKeyFromPair(anotherSig, {
        compressed_public_key: sigInfo.pubKeyCompressed,
        msg: sigInfo.msg,
        r: sigInfo.r,
        s: sigInfo.s,
      });
      storage.savePrivateKey(
        sigInfo.pubKeyCompressed,
        key.walletStringComp,
        key.walletStringUncomp,
        key.privateKeyBuf
      );
      warn(`New key is found`);
      keysFound++;
    }

    storage.saveSignature(
      sigInfo.pubKeyCompressed,
      sigInfo.msg,
      sigInfo.r,
      sigInfo.s
    );
    signaturesSaved++;
  }

  return {
    ecdsaSignature,
    get keysFound() {
      return keysFound;
    },
    get signaturesSaved() {
      return signaturesSaved;
    },
  };
}
