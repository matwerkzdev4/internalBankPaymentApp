const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildConfirmedPaymentExportFileName,
  exportQueuedPayments,
  formatExportDatePart,
  formatExportTimePart,
} = require("../lib/exportQueue");

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
  const now = new Date("2026-04-17T14:30:00");
  const result = exportQueuedPayments([
    {
      corrected: {
        invoiceNumber: "INV-2002",
        amount: "123.45",
        beneficiaryName: "Ang Zhi Wei",
        bankSwiftCode: "DBSSSGSGXXX",
        beneficiaryAccountNumber: "153981779",
        remark: "INV-2002",
        currency: "usd",
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
        currency: "USD",
      },
    },
  ], { now });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.fileName, "USD_17042026_1430_2.txt");

  const lines = result.fileContent.split(/\r\n/);
  assert.equal(lines.length, 4);
  assert.equal(lines[0].slice(13, 38).trimEnd(), "OCBCSGSGXXX601425952201");
  assert.equal(lines[1].slice(240, 247), "INV2002");
  assert.equal(lines[2].slice(240, 247), "INV2003");
});

test("exportQueuedPayments keeps the current payer account for SGD and RMB exports", () => {
  const sgdResult = exportQueuedPayments(
    [
      {
        corrected: {
          invoiceNumber: "INV-1001",
          amount: "10.00",
          beneficiaryName: "Alpha Beta",
          bankSwiftCode: "DBSSSGSGXXX",
          beneficiaryAccountNumber: "123456789",
          remark: "INV-1001",
          currency: "SGD",
        },
      },
    ],
    { currency: "SGD" }
  );
  const rmbResult = exportQueuedPayments(
    [
      {
        corrected: {
          invoiceNumber: "INV-1002",
          amount: "20.00",
          beneficiaryName: "Gamma Delta",
          bankSwiftCode: "DBSSSGSGXXX",
          beneficiaryAccountNumber: "987654321",
          remark: "INV-1002",
          currency: "RMB",
        },
      },
    ],
    { currency: "RMB" }
  );

  assert.equal(
    sgdResult.fileContent.split(/\r\n/)[0].slice(13, 38).trimEnd(),
    "OCBCSGSGXXX601365950001"
  );
  assert.equal(
    rmbResult.fileContent.split(/\r\n/)[0].slice(13, 38).trimEnd(),
    "OCBCSGSGXXX601365950001"
  );
});

test("exportQueuedPayments strips non-alphanumeric characters from exported remarks", () => {
  const result = exportQueuedPayments(
    [
      {
        corrected: {
          invoiceNumber: "INV-4001/2026",
          amount: "10.00",
          beneficiaryName: "Alpha Beta",
          bankSwiftCode: "DBSSSGSGXXX",
          beneficiaryAccountNumber: "123456789",
          remark: "INV-4001/2026 #APR (test)",
          currency: "USD",
        },
      },
    ],
    { currency: "USD" }
  );

  const line = result.fileContent.split(/\r\n/)[1];
  assert.equal(line.slice(240, 260).trimEnd(), "INV40012026APRtest");
});

test("confirmed payment export filename helpers format date, time, and count", () => {
  const now = new Date("2026-04-17T09:45:00");
  assert.equal(formatExportDatePart(now), "17042026");
  assert.equal(formatExportTimePart(now), "0945");
  assert.equal(buildConfirmedPaymentExportFileName("rmb", 3, now), "RMB_17042026_0945_3.txt");
});
