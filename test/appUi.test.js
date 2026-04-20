const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  attachSessionNewSupplierFlags,
  applySupplierDefaults,
  buildNewSupplierPayeeExportFileName,
  buildNewSupplierPayeeExportText,
  buildNewSupplierPayeeGroups,
  extractDownloadFileName,
  getResponseErrorMessage,
  loadSupplierMasterSummary,
  getExtractionSourceLabel,
  getSupplierResolutionUiState,
  getSupplierReviewMissingFields,
  mergeSelectedFiles,
  normalizeCurrencyInput,
  normalizeSupplierLookupKey,
  setSupplierMasterStatus,
  shouldShowSupplierReview,
  updateSupplierReviewRequirement,
  triggerBrowserDownload,
  getSelectedFilesSummary,
  getUnsupportedFileMessage,
  getUploadLimitMessage,
  formatExtractionTime,
  isSupportedUploadFile,
} = require("../public/app");

test("getUploadLimitMessage explains the 10-file cap and performance tradeoff", () => {
  assert.equal(
    getUploadLimitMessage(),
    "Upload up to 5 documents at one time. More files may slow extraction."
  );
});

test("isSupportedUploadFile accepts common document and image aliases", () => {
  assert.equal(isSupportedUploadFile({ name: "invoice.pdf", type: "application/pdf" }), true);
  assert.equal(isSupportedUploadFile({ name: "notes.md", type: "text/markdown" }), true);
  assert.equal(
    isSupportedUploadFile({
      name: "letter.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    true
  );
  assert.equal(isSupportedUploadFile({ name: "scan.jpg", type: "image/jpeg" }), true);
  assert.equal(isSupportedUploadFile({ name: "scan.webp", type: "image/webp" }), true);
  assert.equal(isSupportedUploadFile({ name: "archive.bin", type: "application/octet-stream" }), false);
});

test("getUnsupportedFileMessage explains allowed families", () => {
  assert.match(getUnsupportedFileMessage(), /DOCX/);
  assert.match(getUnsupportedFileMessage(), /JPG/);
  assert.match(getUnsupportedFileMessage(), /TIFF/);
});

test("getExtractionSourceLabel collapses provider wording to the demo-safe labels", () => {
  assert.equal(
    getExtractionSourceLabel({
      finalProvider: "local_parser_plus_openai",
    }),
    "Local parser + OpenAI"
  );
  assert.equal(getExtractionSourceLabel({ finalProvider: "local_parser_only" }), "Local parser only");
});

test("formatExtractionTime keeps the one-decimal-second display", () => {
  assert.equal(formatExtractionTime(1532), "1.5 s");
  assert.equal(formatExtractionTime(0), "0.0 s");
});

test("getSelectedFilesSummary reflects one or more chosen files", () => {
  assert.equal(getSelectedFilesSummary(0), "No files selected yet");
  assert.equal(getSelectedFilesSummary(1), "Step 1 ready: 1 file selected");
  assert.equal(getSelectedFilesSummary(3), "Step 1 ready: 3 files selected");
});

test("mergeSelectedFiles appends a second picker cycle into the existing queue", () => {
  const firstFile = {
    name: "invoice.pdf",
    size: 100,
    lastModified: 1,
    type: "application/pdf",
  };
  const secondFile = {
    name: "bank-details.png",
    size: 200,
    lastModified: 2,
    type: "image/png",
  };

  const result = mergeSelectedFiles([firstFile], [secondFile]);

  assert.equal(result.duplicateCount, 0);
  assert.deepEqual(result.files, [firstFile, secondFile]);
});

test("mergeSelectedFiles ignores exact duplicate files across picker cycles", () => {
  const file = {
    name: "invoice.pdf",
    size: 100,
    lastModified: 1,
    type: "application/pdf",
  };

  const result = mergeSelectedFiles([file], [file]);

  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.files, [file]);
});

test("normalizeSupplierLookupKey collapses whitespace and uppercases supplier names", () => {
  assert.equal(normalizeSupplierLookupKey("  Bright   Supplies pte ltd "), "BRIGHT SUPPLIES PTE LTD");
  assert.equal(normalizeSupplierLookupKey(""), "");
});

test("applySupplierDefaults fills only blank supplier-backed fields", () => {
  const record = applySupplierDefaults(
    {
      supplierName: "Bright Supplies Pte Ltd",
      beneficiaryName: "",
      bankSwiftCode: "",
      beneficiaryAccountNumber: "5555",
      paymentReference: "",
    },
    {
      supplierName: "Bright Supplies Pte Ltd",
      beneficiaryName: "Bright Supplies Pte Ltd",
      bankSwiftCode: "OCBCSGSGXXX",
      beneficiaryAccountNumber: "123456789",
      paymentReference: "DEFAULT REF",
    }
  );

  assert.deepEqual(record, {
    supplierName: "Bright Supplies Pte Ltd",
    beneficiaryName: "Bright Supplies Pte Ltd",
    bankSwiftCode: "OCBCSGSGXXX",
    beneficiaryAccountNumber: "5555",
    paymentReference: "DEFAULT REF",
  });
});

test("attachSessionNewSupplierFlags marks only current-session new supplier records", () => {
  const records = attachSessionNewSupplierFlags(
    [
      {
        supplierName: "Bright Supplies Pte Ltd",
        currency: "usd",
      },
      {
        supplierName: "Orbit Logistics Ltd",
        currency: "sgd",
      },
    ],
    new Set(["BRIGHT SUPPLIES PTE LTD"])
  );

  assert.equal(records[0].isNewSupplierPayee, true);
  assert.equal(records[0].normalizedSupplierKey, "BRIGHT SUPPLIES PTE LTD");
  assert.equal(records[1].isNewSupplierPayee, false);
});

test("buildNewSupplierPayeeGroups groups session-new suppliers by currency and removes duplicates", () => {
  const grouped = buildNewSupplierPayeeGroups([
    {
      supplierName: "Bright Supplies Pte Ltd",
      normalizedSupplierKey: "BRIGHT SUPPLIES PTE LTD",
      beneficiaryName: "Bright Supplies Pte Ltd",
      bankSwiftCode: "DBSSSGSGXXX",
      beneficiaryAccountNumber: "123456789",
      paymentReference: "OPS",
      currency: "usd",
      isNewSupplierPayee: true,
    },
    {
      supplierName: "Bright Supplies Pte Ltd",
      normalizedSupplierKey: "BRIGHT SUPPLIES PTE LTD",
      beneficiaryName: "Bright Supplies Pte Ltd",
      bankSwiftCode: "DBSSSGSGXXX",
      beneficiaryAccountNumber: "123456789",
      paymentReference: "OPS",
      currency: "USD",
      isNewSupplierPayee: true,
    },
    {
      supplierName: "Orbit Logistics Ltd",
      normalizedSupplierKey: "ORBIT LOGISTICS LTD",
      beneficiaryName: "Orbit Logistics Ltd",
      bankSwiftCode: "OCBCSGSGXXX",
      beneficiaryAccountNumber: "99887766",
      paymentReference: "APR",
      currency: "sgd",
      isNewSupplierPayee: true,
    },
    {
      supplierName: "Saved Supplier Ltd",
      normalizedSupplierKey: "SAVED SUPPLIER LTD",
      currency: "usd",
      isNewSupplierPayee: false,
    },
  ]);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].currency, "SGD");
  assert.equal(grouped[0].items.length, 1);
  assert.equal(grouped[1].currency, "USD");
  assert.equal(grouped[1].items.length, 1);
});

test("buildNewSupplierPayeeExportFileName includes currency, date, time, and item count", () => {
  const fileName = buildNewSupplierPayeeExportFileName("usd", 2, new Date("2026-04-17T14:30:00"));
  assert.equal(fileName, "USD_new-payees_17042026_1430_2.txt");
});

test("buildNewSupplierPayeeExportText formats payee details into a plain text export", () => {
  const content = buildNewSupplierPayeeExportText(
    [
      {
        supplierName: "Bright Supplies Pte Ltd",
        beneficiaryName: "Bright Supplies Pte Ltd",
        bankSwiftCode: "DBSSSGSGXXX",
        beneficiaryAccountNumber: "123456789",
        paymentReference: "OPS",
        currency: "USD",
      },
    ],
    "USD"
  );

  assert.match(content, /New Supplier\/Payee List - USD/);
  assert.match(content, /Supplier name: Bright Supplies Pte Ltd/);
  assert.match(content, /Beneficiary bank identifier \/ SWIFT: DBSSSGSGXXX/);
  assert.match(content, /Beneficiary account number: 123456789/);
  assert.match(content, /Default payment reference: OPS/);
});

test("getSupplierResolutionUiState skips review for matched suppliers", () => {
  assert.deepEqual(getSupplierResolutionUiState({ matchStatus: "matched" }), {
    requiresReview: false,
    title: "Supplier found in saved list",
    message: "A saved supplier profile was found and used for any missing bank details.",
    statusType: "ready",
  });
});

test("getSupplierResolutionUiState requires review for new and unclear suppliers", () => {
  assert.equal(getSupplierResolutionUiState({ matchStatus: "not_found" }).requiresReview, true);
  assert.equal(getSupplierResolutionUiState({ matchStatus: "cannot_match" }).requiresReview, true);
});

test("getSupplierReviewMissingFields requires supplier name and bank details", () => {
  assert.deepEqual(getSupplierReviewMissingFields({ supplierName: "" }), [
    "supplierName",
    "bankSwiftCode",
    "beneficiaryAccountNumber",
  ]);
  assert.deepEqual(
    getSupplierReviewMissingFields({
      supplierName: "Orbit Logistics",
      bankSwiftCode: "OCBCSGSGXXX",
      beneficiaryAccountNumber: "12345678",
    }),
    []
  );
});

test("normalizeCurrencyInput accepts lower-case currency values", () => {
  assert.equal(normalizeCurrencyInput("usd"), "USD");
  assert.equal(normalizeCurrencyInput("rmb"), "RMB");
  assert.equal(normalizeCurrencyInput("cny"), "RMB");
});

test("shouldShowSupplierReview opens review when a new supplier name exists", () => {
  updateSupplierReviewRequirement({ matchStatus: "not_found" }, "Bright Supplies Pte Ltd");
  assert.equal(shouldShowSupplierReview({ matchStatus: "not_found" }, { supplierName: "Bright Supplies Pte Ltd" }), true);
  assert.equal(
    shouldShowSupplierReview(
      { matchStatus: "cannot_match" },
      { supplierName: "" }
    ),
    false
  );
});

test("updateSupplierReviewRequirement follows supplier master matching state", () => {
  assert.equal(updateSupplierReviewRequirement({ matchStatus: "matched" }, "Bright Supplies Pte Ltd"), false);
  assert.equal(updateSupplierReviewRequirement({ matchStatus: "not_found" }, "Bright Supplies Pte Ltd"), true);
  assert.equal(updateSupplierReviewRequirement({ matchStatus: "cannot_match" }, ""), false);
});

test("loadSupplierMasterSummary is exposed for supplier master management flow", () => {
  assert.equal(typeof loadSupplierMasterSummary, "function");
});

test("setSupplierMasterStatus is exposed for supplier-only notifications", () => {
  assert.equal(typeof setSupplierMasterStatus, "function");
});

test("extractDownloadFileName returns the filename from content disposition", () => {
  assert.equal(
    extractDownloadFileName('attachment; filename="supplier-master_17042026_1430_12-suppliers.json"', "fallback.json"),
    "supplier-master_17042026_1430_12-suppliers.json"
  );
  assert.equal(
    extractDownloadFileName("attachment; filename*=UTF-8''USD_17042026_1430_2.txt", "fallback.txt"),
    "USD_17042026_1430_2.txt"
  );
  assert.equal(extractDownloadFileName("", "fallback.json"), "fallback.json");
});

test("getResponseErrorMessage returns JSON error text when export responds with JSON", async () => {
  const message = await getResponseErrorMessage(
    {
      headers: {
        get(name) {
          return name === "Content-Type" ? "application/json; charset=utf-8" : null;
        },
      },
      async json() {
        return { error: "Complete the required payment details for every confirmed payment before export." };
      },
    },
    "USD export failed."
  );

  assert.equal(message, "Complete the required payment details for every confirmed payment before export.");
});

test("getResponseErrorMessage falls back to text for non-JSON export failures", async () => {
  const message = await getResponseErrorMessage(
    {
      headers: {
        get() {
          return "text/plain; charset=utf-8";
        },
      },
      async text() {
        return "Gateway timeout while exporting";
      },
    },
    "USD export failed."
  );

  assert.equal(message, "Gateway timeout while exporting");
});

test("triggerBrowserDownload requires browser download APIs", () => {
  assert.throws(
    () => triggerBrowserDownload(Buffer.from("test"), "USD_17042026_1430_2.txt"),
    /cannot start the download automatically/i
  );
});

test("index.html shows the web application intro before the supplier master card", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const heroIndex = indexHtml.indexOf('<section class="hero top-card">');
  const supplierMasterIndex = indexHtml.indexOf('<section class="supplier-master-card top-card">');

  assert.notEqual(heroIndex, -1);
  assert.notEqual(supplierMasterIndex, -1);
  assert.ok(heroIndex < supplierMasterIndex);
});

test("index.html no longer includes the old extracted-details persistence sentence", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

  assert.equal(
    indexHtml.includes("The extracted details stay here until you clear them or run the next extraction."),
    false
  );
  assert.equal(
    appJs.includes("The extracted details stay here until you clear them or run the next extraction."),
    false
  );
});

test("index.html includes the New Supplier/Payee List section after confirmed payments", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const confirmedIndex = indexHtml.indexOf("<h2>Confirmed Payment List</h2>");
  const payeeIndex = indexHtml.indexOf("<h2>New Supplier / Payee Setup List</h2>");

  assert.notEqual(confirmedIndex, -1);
  assert.notEqual(payeeIndex, -1);
  assert.ok(confirmedIndex < payeeIndex);
});

test("index.html includes the finance operator quick-start card and confirm summary", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

  assert.match(indexHtml, /Quick Start For Finance Operators/);
  assert.match(indexHtml, /Confirm payment into list/);
  assert.match(indexHtml, /Confirm supplier details and save to supplier list/);
  assert.match(indexHtml, /Complete the supplier check before confirming this payment\./);
  assert.match(indexHtml, /sectionTwoGuidance/);
  assert.match(indexHtml, /What the app did: it filled what it could\./);
  assert.match(indexHtml, /What to do now: check the highlighted fields and fix anything missing\./);
  assert.match(indexHtml, /Extraction in progress/);
  assert.equal(indexHtml.includes("Bank code used for international payment."), false);
  assert.equal(indexHtml.includes("Before You Confirm"), false);
});
