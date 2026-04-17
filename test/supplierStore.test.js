const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  normalizeSupplierNameKey,
  normalizeSupplierImportRecords,
  readSuppliers,
  replaceSuppliers,
  resolveSupplierMatch,
  saveSupplier,
  suppliersFilePath,
  writeSuppliers,
} = require("../lib/supplierStore");

test("supplier store bootstraps and persists records across re-read", () => {
  writeSuppliers([]);

  const saved = saveSupplier({
    supplierName: "Bright Supplies Pte Ltd",
    beneficiaryName: "Bright Supplies Pte Ltd",
    bankSwiftCode: "ocbcsgsgxxx",
    beneficiaryAccountNumber: "123 456 789",
    paymentReference: "OPS",
  });

  assert.equal(saved.normalizedSupplierKey, "BRIGHT SUPPLIES PTE LTD");
  assert.equal(fs.existsSync(suppliersFilePath), true);

  const records = readSuppliers();
  assert.equal(records.length, 1);
  assert.equal(records[0].bankSwiftCode, "OCBCSGSGXXX");
  assert.equal(records[0].beneficiaryAccountNumber, "123456789");
});

test("resolveSupplierMatch finds exact normalized supplier name matches", () => {
  writeSuppliers([
    {
      supplierName: "Orbit Logistics Ltd",
      beneficiaryName: "Orbit Logistics Ltd",
      bankSwiftCode: "AAAABBCC",
      beneficiaryAccountNumber: "99887766",
      paymentReference: "",
      normalizedSupplierKey: "ORBIT LOGISTICS LTD",
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
  ]);

  const result = resolveSupplierMatch({ supplierName: "  orbit   logistics ltd " });
  assert.equal(result.matchStatus, "matched");
  assert.equal(result.matched, true);
  assert.equal(result.supplier?.supplierName, "Orbit Logistics Ltd");
});

test("resolveSupplierMatch returns cannot_match for blank supplier names", () => {
  const result = resolveSupplierMatch({ supplierName: "   " });
  assert.equal(result.matchStatus, "cannot_match");
  assert.equal(result.matched, false);
  assert.equal(result.normalizedSupplierKey, null);
});

test("saveSupplier upserts by normalized key and preserves createdAt", () => {
  writeSuppliers([]);

  const first = saveSupplier({
    supplierName: "Nova Trade Pte Ltd",
    beneficiaryName: "Nova Trade Pte Ltd",
    bankSwiftCode: "FIRSTSGS",
    beneficiaryAccountNumber: "111111",
  });
  const second = saveSupplier({
    supplierName: " nova trade pte ltd ",
    beneficiaryName: "Nova Trade Operations",
    bankSwiftCode: "SECONDSG",
    beneficiaryAccountNumber: "222222",
    paymentReference: "APRIL",
  });

  const records = readSuppliers();
  assert.equal(records.length, 1);
  assert.equal(second.createdAt, first.createdAt);
  assert.notEqual(second.updatedAt, first.updatedAt);
  assert.equal(records[0].beneficiaryName, "Nova Trade Operations");
  assert.equal(normalizeSupplierNameKey(records[0].supplierName), "NOVA TRADE PTE LTD");
});

test("saveSupplier rejects supplier profiles with missing bank details", () => {
  writeSuppliers([]);

  assert.throws(
    () =>
      saveSupplier({
        supplierName: "Incomplete Supplier Pte Ltd",
        beneficiaryName: "Incomplete Supplier Pte Ltd",
        bankSwiftCode: "",
        beneficiaryAccountNumber: "",
      }),
    /insufficient details to create this supplier profile/i
  );
  assert.equal(readSuppliers().length, 0);
});

test("replaceSuppliers fully replaces the local supplier master list", () => {
  writeSuppliers([
    {
      supplierName: "Old Supplier Ltd",
      beneficiaryName: "Old Supplier Ltd",
      bankSwiftCode: "OLDDSGSG",
      beneficiaryAccountNumber: "111111",
      paymentReference: "",
      normalizedSupplierKey: "OLD SUPPLIER LTD",
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
  ]);

  const nextRecords = replaceSuppliers([
    {
      supplierName: "  New Supplier Pte Ltd ",
      beneficiaryName: "New Supplier Ops",
      bankSwiftCode: "newsgsgx",
      beneficiaryAccountNumber: "222 333",
      paymentReference: "APR",
    },
  ]);

  assert.equal(nextRecords.length, 1);
  assert.equal(nextRecords[0].supplierName, "New Supplier Pte Ltd");
  assert.equal(nextRecords[0].bankSwiftCode, "NEWSGSGX");
  assert.equal(nextRecords[0].beneficiaryAccountNumber, "222333");
  assert.equal(readSuppliers()[0].normalizedSupplierKey, "NEW SUPPLIER PTE LTD");
});

test("normalizeSupplierImportRecords rejects invalid import shapes", () => {
  assert.throws(() => normalizeSupplierImportRecords({ supplierName: "Bad" }), /JSON array/i);
  assert.throws(() => normalizeSupplierImportRecords(["bad-row"]), /JSON object/i);
  assert.throws(
    () => normalizeSupplierImportRecords([{ supplierName: "Bad Supplier", bankSwiftCode: "", beneficiaryAccountNumber: "" }]),
    /insufficient details to create this supplier profile/i
  );
});
