const test = require("node:test");
const assert = require("node:assert/strict");
const { exportQueuedPayments } = require("../lib/exportQueue");
const { buildSupplierMasterExportFileName, startServer } = require("../server");

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
  assert.match(result.fileContent, /OCBCSGSGXXX601425952201/);
  assert.match(result.fileContent, /INV2002/);
  assert.match(result.fileContent, /INV2003/);
});

test("startServer supports dynamic local ports for desktop packaging", async () => {
  const { port, url, server } = await startServer({
    port: 0,
    host: "127.0.0.1",
  });

  try {
    assert.ok(Number.isInteger(port));
    assert.ok(port > 0);
    assert.equal(url, `http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
