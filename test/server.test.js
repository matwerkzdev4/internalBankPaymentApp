const test = require("node:test");
const assert = require("node:assert/strict");
const { exportQueuedPayments } = require("../lib/exportQueue");
const { buildSupplierMasterExportFileName } = require("../server");

test("buildSupplierMasterExportFileName includes readable label, date, time, and supplier count", () => {
  const fileName = buildSupplierMasterExportFileName(new Array(12).fill({}), new Date("2026-04-17T14:30:00"));
  assert.equal(fileName, "supplier-master_17042026_1430_12-suppliers.json");
});

test("confirmed payment export accepts raw merged queue records from the saved queue shape", () => {
  const result = exportQueuedPayments(
    [
      {
        supplierName: "Bright Supplies Pte Ltd",
        invoiceNumber: "INV-2002",
        amount: "123.45",
        currency: "usd",
        beneficiaryName: "Bright Supplies Pte Ltd",
        bankSwiftCode: "DBSSSGSGXXX",
        beneficiaryAccountNumber: "153981779",
        remark: "INV-2002",
      },
      {
        supplierName: "Orbit Trading",
        invoiceNumber: "INV-2003",
        amount: "88.20",
        currency: "USD",
        beneficiaryName: "Orbit Trading",
        bankSwiftCode: "OCBCSGSGXXX",
        beneficiaryAccountNumber: "609029475001",
        remark: "INV-2003",
      },
    ],
    {
      currency: "USD",
      now: new Date("2026-04-17T14:30:00"),
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.fileName, "USD_17042026_1430_2.txt");
  assert.match(result.fileContent, /INV-2002/);
  assert.match(result.fileContent, /INV-2003/);
});
