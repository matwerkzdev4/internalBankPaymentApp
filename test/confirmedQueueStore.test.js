const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  clearConfirmedQueue,
  readConfirmedQueue,
  writeConfirmedQueue,
} = require("../lib/confirmedQueueStore");

const queueFilePath = path.join(__dirname, "..", "data", "confirmed-queue.json");

test("writeConfirmedQueue persists normalized queue records", () => {
  const records = writeConfirmedQueue([
    {
      supplierName: "Example Supplier Pte Ltd",
      invoiceNumber: "INV-1001",
      amount: "123.4",
      currency: "cny",
      beneficiaryName: "Example Supplier Pte Ltd",
      bankSwiftCode: "abcdsgsg",
      beneficiaryAccountNumber: "123 456 789",
      remark: "INV-1001",
    },
  ]);

  assert.equal(records.length, 1);
  assert.equal(records[0].amount, "123.40");
  assert.equal(records[0].currency, "RMB");
  assert.equal(records[0].bankSwiftCode, "ABCDSGSG");
  assert.equal(records[0].beneficiaryAccountNumber, "123456789");

  const saved = JSON.parse(fs.readFileSync(queueFilePath, "utf8"));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].currency, "RMB");
});

test("clearConfirmedQueue resets the persisted queue", () => {
  writeConfirmedQueue([
    {
      supplierName: "Temp Supplier",
      invoiceNumber: "TMP-1",
      amount: "1.00",
      beneficiaryName: "Temp Supplier",
      bankSwiftCode: "AAAABBCC",
      beneficiaryAccountNumber: "111111",
      remark: "TMP-1",
    },
  ]);

  clearConfirmedQueue();

  assert.deepEqual(readConfirmedQueue(), []);
});
