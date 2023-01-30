export function getDbPath(dbFileName: string) {
  const dataFolder = process.env.SCANNER_STORAGE_DIR;
  if (!dataFolder) {
    throw new Error(`Env variable SCANNER_STORAGE_DIR is not defined`);
  }
  return dataFolder + "/" + dbFileName;
}
