const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const WINDOWS_APP_DIR_NAME = "Bank Payment Extraction Tool";
const FALLBACK_APP_DIR_NAME = ".bank-payment-extraction-tool";
let resolvedBaseAppDataDir = null;

function tryEnsureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function getWritableBaseDirCandidates() {
  const candidates = [];

  if (process.env.BANK_PAYMENT_DATA_DIR) {
    candidates.push(path.resolve(process.env.BANK_PAYMENT_DATA_DIR));
  }

  if (process.platform === "win32") {
    const localAppDataRoot =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const roamingAppDataRoot =
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const tempRoot = process.env.TEMP || process.env.TMP || os.tmpdir();

    candidates.push(path.join(localAppDataRoot, WINDOWS_APP_DIR_NAME));
    candidates.push(path.join(roamingAppDataRoot, WINDOWS_APP_DIR_NAME));
    candidates.push(path.join(tempRoot, WINDOWS_APP_DIR_NAME));
  }

  candidates.push(path.join(os.homedir(), FALLBACK_APP_DIR_NAME));
  return candidates;
}

function getBaseAppDataDir() {
  if (resolvedBaseAppDataDir) {
    return resolvedBaseAppDataDir;
  }

  const candidates = getWritableBaseDirCandidates();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      resolvedBaseAppDataDir = tryEnsureDirectory(candidate);
      return resolvedBaseAppDataDir;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No writable application data directory is available.");
}

function getDataDir() {
  return path.join(getBaseAppDataDir(), "data");
}

function ensureDirectory(dirPath) {
  return tryEnsureDirectory(dirPath);
}

function getDataFilePath(fileName) {
  return path.join(getDataDir(), fileName);
}

module.exports = {
  ensureDirectory,
  getBaseAppDataDir,
  getDataDir,
  getDataFilePath,
};
