const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPaymentRecord } = require("../lib/paymentRecord");
const {
  buildBankFile,
  buildBankFileFromRecords,
  createHeaderRow,
  createTransactionRow,
  formatExportDate,
  sanitizeAlphanumeric,
  sanitizeBeneficiaryName,
} = require("../lib/bankFile");

test("formatExportDate returns DDMMYYYY", () => {
  const formatted = formatExportDate(new Date(2026, 3, 7));
  assert.equal(formatted, "07042026");
});

test("transaction row maps required fields into fixed-width positions", () => {
  const paymentRecord = buildPaymentRecord({
    corrected: {
      bankSwiftCode: "OCBC-SGSG/XXX",
      beneficiaryAccountNumber: "6090-2947 5001",
      beneficiaryName: "Leong Yew Wei / Co.",
      amount: "123.45",
      invoiceNumber: "INV-1001",
      remark: "INV-1001 / Apr",
    },
  });

  const row = createTransactionRow(paymentRecord);
  assert.equal(row.length, 1000);
  assert.equal(row.slice(0, 23), "OCBCSGSGXXX609029475001");
  assert.equal(row.slice(45, 63).trimEnd(), "Leong Yew Wei  Co");
  assert.equal(row.slice(188, 205), "00000000000012345");
  assert.equal(row.slice(240, 253).trimEnd(), "INV1001Apr");
});

test("bank file contains header row and one transaction row", () => {
  const paymentRecord = buildPaymentRecord({
    corrected: {
      bankSwiftCode: "DBSSSGSGXXX",
      beneficiaryAccountNumber: "153981779",
      beneficiaryName: "Ang Zhi Wei",
      amount: "123.45",
      invoiceNumber: "INV-2002",
      remark: "INV-2002",
    },
  });

  const file = buildBankFile(paymentRecord);
  const lines = file.split(/\r\n/);
  assert.equal(lines[0].length, 1000);
  assert.equal(lines[1].length, 1000);
  assert.equal(lines.length, 3);
});

test("header row uses dynamic export date in DDMMYYYY format", () => {
  const headerRow = createHeaderRow({
    scheduledPaymentDate: formatExportDate(new Date(2026, 3, 15)),
  });

  assert.equal(headerRow.slice(225, 233), "15042026");
});

test("header row keeps current payer account for SGD and RMB, and uses USD payer account for USD", () => {
  const sgdHeader = createHeaderRow({ currency: "SGD" });
  const rmbHeader = createHeaderRow({ currency: "RMB" });
  const usdHeader = createHeaderRow({ currency: "USD" });

  assert.equal(sgdHeader.slice(13, 38).trimEnd(), "OCBCSGSGXXX601365950001");
  assert.equal(rmbHeader.slice(13, 38).trimEnd(), "OCBCSGSGXXX601365950001");
  assert.equal(usdHeader.slice(13, 38).trimEnd(), "OCBCSGSGXXX601425952201");
});

test("sanitizeAlphanumeric removes spaces and symbols from exported text fields", () => {
  assert.equal(sanitizeAlphanumeric("Leong Yew Wei / Co."), "LeongYewWeiCo");
  assert.equal(sanitizeAlphanumeric("INV-1001 / Apr"), "INV1001Apr");
});

test("sanitizeBeneficiaryName keeps case and spaces, but removes other symbols", () => {
  assert.equal(sanitizeBeneficiaryName("Leong Yew Wei / Co."), "Leong Yew Wei  Co");
  assert.equal(sanitizeBeneficiaryName("ACME-TOOLS (S) PTE LTD"), "ACMETOOLS S PTE LTD");
});

test("bank file contains one header row and one transaction row per confirmed payment", () => {
  const firstRecord = buildPaymentRecord({
    corrected: {
      bankSwiftCode: "DBSS-SGSG/XXX",
      beneficiaryAccountNumber: "153-981 779",
      beneficiaryName: "Ang Zhi Wei",
      amount: "123.45",
      invoiceNumber: "INV-2002",
      remark: "INV-2002",
    },
  });
  const secondRecord = buildPaymentRecord({
    corrected: {
      bankSwiftCode: "OCBC-SGSG/XXX",
      beneficiaryAccountNumber: "6090-2947 5001",
      beneficiaryName: "Leong Yew Wei",
      amount: "88.20",
      invoiceNumber: "INV-2003",
      remark: "INV-2003",
    },
  });

  const file = buildBankFileFromRecords([firstRecord, secondRecord], {
    scheduledPaymentDate: formatExportDate(new Date(2026, 3, 15)),
  });
  const lines = file.split(/\r\n/);

  assert.equal(lines[0].length, 1000);
  assert.equal(lines[1].length, 1000);
  assert.equal(lines[2].length, 1000);
  assert.equal(lines.length, 4);
  assert.equal(lines[0].slice(225, 233), "15042026");
  assert.equal(lines[1].slice(0, 20), "DBSSSGSGXXX153981779");
  assert.equal(lines[2].slice(0, 23), "OCBCSGSGXXX609029475001");
  assert.equal(lines[1].slice(240, 248).trimEnd(), "INV2002");
  assert.equal(lines[2].slice(240, 248).trimEnd(), "INV2003");
});
