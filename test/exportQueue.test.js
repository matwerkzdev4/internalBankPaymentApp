const test = require("node:test");
const assert = require("node:assert/strict");
const { exportQueuedPayments } = require("../lib/exportQueue");

test("exportQueuedPayments rejects empty confirmed queue", () => {
  const result = exportQueuedPayments([]);

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Add at least one confirmed payment before export.");
});

test("exportQueuedPayments rejects queue when any confirmed record is invalid", () => {
  const result = exportQueuedPayments([
    {
      corrected: {
        invoiceNumber: "INV-2002",
        amount: "123.45",
        beneficiaryName: "Ang Zhi Wei",
        bankSwiftCode: "DBSSSGSGXXX",
        beneficiaryAccountNumber: "153981779",
        remark: "INV-2002",
      },
    },
    {
      corrected: {
        invoiceNumber: "",
        amount: "88.20",
        beneficiaryName: "Leong Yew Wei",
        bankSwiftCode: "OCBCSGSGXXX",
        beneficiaryAccountNumber: "609029475001",
        remark: "",
      },
    },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.body.invalidRecordIndex, 1);
  assert.deepEqual(result.body.validation.missingFields.sort(), ["invoiceNumber"]);
});

test("exportQueuedPayments exports one header and one row per confirmed payment", () => {
  const result = exportQueuedPayments([
    {
      corrected: {
        invoiceNumber: "INV-2002",
        amount: "123.45",
        beneficiaryName: "Ang Zhi Wei",
        bankSwiftCode: "DBSSSGSGXXX",
        beneficiaryAccountNumber: "153981779",
        remark: "INV-2002",
      },
    },
    {
      corrected: {
        invoiceNumber: "INV-2003",
        amount: "88.20",
        beneficiaryName: "Leong Yew Wei",
        bankSwiftCode: "OCBCSGSGXXX",
        beneficiaryAccountNumber: "609029475001",
        remark: "INV-2003",
      },
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.fileName, "bank-payments.txt");

  const lines = result.fileContent.split(/\r\n/);
  assert.equal(lines.length, 4);
  assert.equal(lines[1].slice(240, 248), "INV-2002");
  assert.equal(lines[2].slice(240, 248), "INV-2003");
});
