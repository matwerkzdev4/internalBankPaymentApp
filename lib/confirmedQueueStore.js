const fs = require("node:fs");
const { buildPaymentRecord } = require("./paymentRecord");
const { ensureDirectory, getDataDir, getDataFilePath } = require("./appDataPaths");

const queueFilePath = getDataFilePath("confirmed-queue.json");

function ensureQueueStore() {
  ensureDirectory(getDataDir());

  if (!fs.existsSync(queueFilePath)) {
    fs.writeFileSync(queueFilePath, "[]\n", "utf8");
  }
}

function normalizeQueueRecords(records = []) {
  return records.map((record) => buildPaymentRecord({ corrected: record }).merged);
}

function readConfirmedQueue() {
  ensureQueueStore();

  try {
    const raw = fs.readFileSync(queueFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeQueueRecords(parsed) : [];
  } catch (error) {
    return [];
  }
}

function writeConfirmedQueue(records = []) {
  ensureQueueStore();
  const normalizedRecords = normalizeQueueRecords(records);
  fs.writeFileSync(queueFilePath, `${JSON.stringify(normalizedRecords, null, 2)}\n`, "utf8");
  return normalizedRecords;
}

function clearConfirmedQueue() {
  return writeConfirmedQueue([]);
}

module.exports = {
  clearConfirmedQueue,
  queueFilePath,
  readConfirmedQueue,
  writeConfirmedQueue,
};
