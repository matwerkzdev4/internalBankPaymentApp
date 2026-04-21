const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "bank-payment-app-simple-tests-")
);

process.env.BANK_PAYMENT_DATA_DIR = testDataDir;
