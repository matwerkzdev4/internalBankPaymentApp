const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  getBaseAppDataDir,
  getDataDir,
  getDataFilePath,
} = require("../lib/appDataPaths");

test("app data helpers resolve storage inside the configured data root", () => {
  const baseDir = getBaseAppDataDir();
  assert.equal(baseDir, path.resolve(process.env.BANK_PAYMENT_DATA_DIR));
  assert.equal(getDataDir(), path.join(baseDir, "data"));
  assert.equal(getDataFilePath("suppliers.json"), path.join(baseDir, "data", "suppliers.json"));
});
