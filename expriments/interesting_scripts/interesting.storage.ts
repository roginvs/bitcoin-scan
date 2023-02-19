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

export function createInterestingScriptStorage() {
  const currentFiles = fs
    .readdirSync(__dirname + "/data/")
    .filter((fName) => fName.endsWith(".bin"))
    .sort();
  let currentIndex = currentFiles[currentFiles.length - 1]
    ? Number(currentFiles[currentFiles.length - 1].slice(0, -4)) + 1
    : 1;

  const currentScriptsAsStrings = currentFiles.map((fName) => {
    const scriptData = fs.readFileSync(__dirname + "/data/" + fName).toString();
    return scriptData;
  });

  function isThisScriptInterstingAndNew(script: string[]) {
    const zeroedPacked = zeroScriptPushes(script).join(" ");
    if (currentScriptsAsStrings.indexOf(zeroedPacked) > -1) {
      return false;
    }
    const scriptFileName =
      ("00000000" + currentIndex.toString()).slice(-8) + ".bin";

    console.info(`New script index=${currentIndex} fName=${scriptFileName}`);
    console.info(printScript(script, 1));

    fs.writeFileSync(__dirname + "/data/" + scriptFileName, zeroedPacked);
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
