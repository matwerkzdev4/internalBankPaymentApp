const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildOpenAiPrompt,
  extractPaymentDetails,
  extractFromDocuments,
  getInvalidUploadFiles,
  isSupportedUploadFile,
  mergeFieldSets,
  normalizeCurrencyCode,
  pickMissingFields,
} = require("../lib/extraction");
const { buildPaymentRecord, validatePaymentRecord } = require("../lib/paymentRecord");

test("extractPaymentDetails pulls key invoice and bank fields from text", () => {
  const details = extractPaymentDetails(`
    Supplier: Bright Supplies Pte Ltd
    Invoice Number: INV-7788
    Amount Due: SGD 345.67
    Due Date: 14/04/2026
    Beneficiary Name: Bright Supplies Pte Ltd
    Bank Swift: OCBCSGSGXXX
    Account Number: 622233344455
  `);

  assert.equal(details.supplierName, "Bright Supplies Pte Ltd");
  assert.equal(details.invoiceNumber, "INV-7788");
  assert.equal(details.amount, "345.67");
  assert.equal(details.bankSwiftCode, "OCBCSGSGXXX");
  assert.equal(details.beneficiaryAccountNumber, "622233344455");
});

test("validation blocks export when required fields are missing", () => {
  const paymentRecord = buildPaymentRecord({
    corrected: {
      supplierName: "Bright Supplies Pte Ltd",
      invoiceNumber: "",
      amount: "345.67",
      beneficiaryName: "",
      bankSwiftCode: "",
      beneficiaryAccountNumber: "",
    },
  });

  const validation = validatePaymentRecord(paymentRecord);
  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.missingFields.sort(), [
    "bankSwiftCode",
    "beneficiaryAccountNumber",
    "invoiceNumber",
  ]);
});

test("pickMissingFields reports incomplete local parser results", () => {
  const paymentRecord = buildPaymentRecord({
    extracted: {
      supplierName: "Bright Supplies Pte Ltd",
      invoiceNumber: "INV-7788",
      amount: "345.67",
    },
  });

  assert.deepEqual(pickMissingFields(paymentRecord).sort(), [
    "bankSwiftCode",
    "beneficiaryAccountNumber",
  ]);
});

test("mergeFieldSets fills only missing values from the second pass", () => {
  const localExtracted = {
    supplierName: "Local Supplier",
    invoiceNumber: "INV-1001",
    amount: "",
    beneficiaryName: "",
  };

  const openAiExtracted = {
    supplierName: "OpenAI Supplier",
    invoiceNumber: "INV-9999",
    amount: "88.20",
    beneficiaryName: "Local Supplier",
  };

  assert.deepEqual(mergeFieldSets(localExtracted, openAiExtracted), {
    supplierName: "Local Supplier",
    invoiceNumber: "INV-1001",
    amount: "88.20",
    beneficiaryName: "Local Supplier",
  });
});

test("supplier extraction prefers top company over person and buyer company", () => {
  const details = extractPaymentDetails(`
    ACME INDUSTRIAL PTE LTD
    123 Supplier Street
    Bill To: Matwerkz Technologies
    Attention: DR LEONG
    Invoice Number: INV-501
    Amount Due: SGD 220.00
  `);

  assert.equal(details.supplierName, "ACME INDUSTRIAL PTE LTD");
});

test("cod invoice leaves bank details blank", () => {
  const details = extractPaymentDetails(`
    FRESH GOODS PTE LTD
    Invoice Number: COD-88
    Amount Due: SGD 58.40
    Terms: COD
    Account Number: 123456789
    Bank Swift: OCBCSGSGXXX
  `);

  assert.equal(details.supplierName, "FRESH GOODS PTE LTD");
  assert.equal(details.bankSwiftCode, "");
  assert.equal(details.beneficiaryAccountNumber, "");
});

test("unclear person-only header does not become supplier name", () => {
  const details = extractPaymentDetails(`
    DR LEONG
    Bill To: Matwerkz Technologies
    Invoice Number: INV-777
    Amount Due: SGD 100.00
  `);

  assert.equal(details.supplierName, "");
});

test("matwerkz buyer company variants do not become supplier name", () => {
  const details = extractPaymentDetails(`
    Bill To: Matwerkz Technologies Pte. Ltd.
    Ship To: Matwerkz Technologies Pte Ltd
    Supplier: Matwerkz Technologies
    Invoice Number: INV-888
    Amount Due: SGD 100.00
  `);

  assert.equal(details.supplierName, "");
});

test("supplier can be found away from the top by legal designator", () => {
  const details = extractPaymentDetails(`
    TAX INVOICE
    Bill To: Matwerkz Technologies Pte Ltd
    Contact: Jane Lim
    Service details for April
    Remit To: ORBITAL SYSTEMS PRIVATE LIMITED
    Invoice Number: INV-9901
    Amount Due: SGD 410.00
  `);

  assert.equal(details.supplierName, "ORBITAL SYSTEMS PRIVATE LIMITED");
});

test("buildOpenAiPrompt includes compact suffix block and core guardrails", () => {
  const prompt = buildOpenAiPrompt(
    {
      supplierName: "",
      invoiceNumber: "",
      amount: "",
    },
    ["invoiceNumber", "amount", "bankSwiftCode"]
  );

  assert.match(prompt, /Corporate suffix reference:/);
  assert.match(prompt, /Ltd: Global UK/);
  assert.match(prompt, /Pte Ltd: APAC SG/);
  assert.match(prompt, /LLC: Global US/);
  assert.match(prompt, /SA de CV: LATAM MX/);
  assert.match(prompt, /Matwerkz Technologies Pte Ltd/);
  assert.match(prompt, /search the document for a company name with a legal designator/i);
  assert.match(prompt, /leave bankSwiftCode and beneficiaryAccountNumber blank unless clearly shown/i);
  assert.match(prompt, /look especially near the bottom half of the document/i);
  assert.match(prompt, /look for codes SGD, RMB, CNY, USD, and GBP/i);
  assert.match(prompt, /Normalize CNY to RMB/i);
  assert.match(prompt, /Current parser result:/);
  assert.match(prompt, /Focus especially on these missing fields: invoiceNumber, amount, bankSwiftCode\./);

  const suffixLines = prompt
    .split("\n")
    .filter((line) => line.includes(":") && !line.startsWith("Current parser result:"));
  assert.ok(suffixLines.length >= 26);
});

test("extractPaymentDetails prefers bottom-half payable total labels", () => {
  const details = extractPaymentDetails(`
    Item A  SGD 40.00
    Subtotal: SGD 40.00
    Tax: SGD 3.20

    Footer notes
    Total payable amount: SGD 43.20
  `);

  assert.equal(details.amount, "43.20");
});

test("extractPaymentDetails finds payable amount label variant", () => {
  const details = extractPaymentDetails(`
    Invoice Number: INV-9902
    Services summary
    Payable amount: USD 188.50
  `);

  assert.equal(details.amount, "188.50");
  assert.equal(details.currency, "USD");
});

test("extractPaymentDetails prefers top-half currency code and normalizes CNY to RMB", () => {
  const details = extractPaymentDetails(`
    Qty  Description  Currency
    1    Consulting   CNY
    Invoice Number: INV-8801
    Total amount: 300.00
    Beneficiary bank details below
    Swift: BKCHCNBJ
  `);

  assert.equal(details.currency, "RMB");
});

test("extractPaymentDetails can find currency near bank details when top half has none", () => {
  const details = extractPaymentDetails(`
    Invoice Number: INV-8802
    Service fee summary
    Total amount: 900.00
    Beneficiary bank details
    Currency: GBP
    Swift: BARCGB22
  `);

  assert.equal(details.currency, "GBP");
});

test("normalizeCurrencyCode maps CNY to RMB", () => {
  assert.equal(normalizeCurrencyCode("CNY"), "RMB");
  assert.equal(normalizeCurrencyCode("usd"), "USD");
});

test("extractFromDocuments reports currencyExtracted false when fallback SGD is used", async () => {
  const { extractFromDocuments } = require("../lib/extraction");

  const result = await extractFromDocuments([
    {
      originalname: "invoice.txt",
      mimetype: "text/plain",
      buffer: Buffer.from("Invoice Number: INV-3001\nTotal amount: 120.00\n"),
      size: 48,
    },
  ]);

  assert.equal(result.paymentRecord.merged.currency, "SGD");
  assert.equal(result.extractionMeta.currencyExtracted, false);
  assert.ok(Number.isFinite(result.extractionMeta.totalExtractionMs));
});

test("extractFromDocuments reports currencyExtracted true when currency is found", async () => {
  const result = await extractFromDocuments([
    {
      originalname: "invoice.txt",
      mimetype: "text/plain",
      buffer: Buffer.from("Invoice Number: INV-3002\nCurrency: USD\nTotal amount: 120.00\n"),
      size: 62,
    },
  ]);

  assert.equal(result.paymentRecord.merged.currency, "USD");
  assert.equal(result.extractionMeta.currencyExtracted, true);
  assert.ok(Number.isFinite(result.extractionMeta.totalExtractionMs));
});

test("extractFromDocuments supports markdown files", async () => {
  const result = await extractFromDocuments([
    {
      originalname: "invoice.md",
      mimetype: "text/markdown",
      buffer: Buffer.from("Supplier: Bright Supplies Pte Ltd\nInvoice Number: INV-MD-1\nAmount Due: SGD 88.50\n"),
      size: 84,
    },
  ]);

  assert.equal(result.paymentRecord.merged.invoiceNumber, "INV-MD-1");
  assert.equal(result.paymentRecord.merged.amount, "88.50");
  assert.equal(result.paymentRecord.merged.currency, "SGD");
});

test("extractFromDocuments supports docx files", async () => {
  const buffer = fs.readFileSync(path.join(__dirname, "fixtures", "sample-valid.docx"));
  const result = await extractFromDocuments([
    {
      originalname: "sample.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
      size: buffer.length,
    },
  ]);

  assert.equal(result.paymentRecord.merged.invoiceNumber, "INV-DOCX-1");
  assert.equal(result.paymentRecord.merged.amount, "123.45");
  assert.equal(result.paymentRecord.merged.bankSwiftCode, "OCBCSGSGXXX");
  assert.equal(result.paymentRecord.merged.beneficiaryAccountNumber, "622233344455");
});

test("supported upload validation accepts common image aliases and rejects unknown binaries", () => {
  assert.equal(isSupportedUploadFile({ originalname: "scan.jpg", mimetype: "image/jpeg" }), true);
  assert.equal(isSupportedUploadFile({ originalname: "scan.tiff", mimetype: "image/tiff" }), true);
  assert.equal(isSupportedUploadFile({ originalname: "scan.webp", mimetype: "image/webp" }), true);
  assert.equal(isSupportedUploadFile({ originalname: "archive.bin", mimetype: "application/octet-stream" }), false);

  const invalidFiles = getInvalidUploadFiles([
    { originalname: "invoice.pdf", mimetype: "application/pdf" },
    { originalname: "archive.bin", mimetype: "application/octet-stream" },
  ]);

  assert.deepEqual(invalidFiles.map((file) => file.originalname), ["archive.bin"]);
});
