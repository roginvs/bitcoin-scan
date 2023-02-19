import * as fs from "fs";
import { printScript, readScript } from "./read_script";

function zeroScriptPushes(script: string[]) {
  return script.map((sLine) => {
    if (sLine.startsWith("OP_")) {
      return sLine;
    }
    // hex value, change to all '0'
    return "0".repeat(sLine.length);
  });
}

function normalizeScriptText(scriptText: string) {
  const script = scriptText
    .split(/\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line)
    .filter((line) => !line.startsWith("#"))
    .flatMap((line) => line.split(" ").filter((op) => op));
  return zeroScriptPushes(script).join(" ");
}

const EXTENSION = ".txt";
export function createInterestingScriptStorage() {
  const currentFiles = fs
    .readdirSync(__dirname + "/data/")
    .filter((fName) => fName.endsWith(EXTENSION))
    .sort();
  let currentIndex = currentFiles[currentFiles.length - 1]
    ? Number(
        currentFiles[currentFiles.length - 1].slice(0, -EXTENSION.length)
      ) + 1
    : 1;

  const currentScriptsAsStrings = currentFiles.map((fName) => {
    const scriptData = fs.readFileSync(__dirname + "/data/" + fName).toString();
    return normalizeScriptText(scriptData);
  });

  function isThisScriptInterstingAndNew(script: string[]) {
    const zeroedPacked = zeroScriptPushes(script).join(" ");
    if (currentScriptsAsStrings.indexOf(zeroedPacked) > -1) {
      return false;
    }

    const numLen = 8;
    const scriptFileName =
      ("0".repeat(numLen) + currentIndex.toString()).slice(-numLen) + EXTENSION;

    console.info(`New script index=${currentIndex} fName=${scriptFileName}`);
    console.info(printScript(script, 1));

    fs.writeFileSync(
      __dirname + "/data/" + scriptFileName,
      printScript(script)
    );
    currentIndex++;

    currentScriptsAsStrings.push(zeroedPacked);

    return { scriptFileName };
  }

  console.info(
    `Storage created, loaded ${currentScriptsAsStrings.length} scripts, next index=${currentIndex}`
  );

  // console.info(currentScriptsAsStrings);

  return {
    isThisScriptInterstingAndNew,
  };
}
