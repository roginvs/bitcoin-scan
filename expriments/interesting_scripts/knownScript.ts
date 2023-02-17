import { seenScripts } from "./knownScripts.data";

const transformedScripts = seenScripts
  .split(/---+\n/)
  .map((scriptRaw) => {
    return scriptRaw
      .split(/\r|\n/)
      .map((x) => x.trim())
      .filter((x) => !x.startsWith("#"))
      .flatMap((x) => x.split(" "))
      .filter((x) => x);
  })
  .filter((s) => s.length > 0);

export function isThisKindOfScriptAlreadyKnown(script: string[]) {
  const isSimilarSeen =
    transformedScripts
      .filter((s) => s.length === script.length)
      .filter((candidate) => {
        for (let i = 0; i < script.length; i++) {
          const scriptOp = script[i];
          const candidateOp = candidate[i];
          if (
            (scriptOp.startsWith("OP_") || candidateOp.startsWith("OP_")) &&
            scriptOp !== candidateOp
          ) {
            return false;
          }

          return true;
        }
      }).length > 0;
  return isSimilarSeen;
}
