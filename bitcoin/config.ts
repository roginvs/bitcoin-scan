export function getDbPath(dbFileName: string) {
  const dataFolder = process.env.NODE_STORAGE_DIR;
  if (!dataFolder) {
    throw new Error(`Env variable NODE_STORAGE_DIR is not defined`);
  }
  return dataFolder + "/" + dbFileName;
}
