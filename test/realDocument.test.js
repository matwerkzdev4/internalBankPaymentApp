const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractFromDocuments } = require("../lib/extraction");

test("SFExpress.pdf keeps bank details in manual-input flow when text cannot be extracted", async () => {
  const pdfPath = path.join(__dirname, "..", "SFExpress.pdf");
  const buffer = fs.readFileSync(pdfPath);

  const result = await extractFromDocuments([
    {
      originalname: "SFExpress.pdf",
      mimetype: "application/pdf",
      buffer,
      size: buffer.length,
    },
  ]);

  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].fileName, "SFExpress.pdf");
  assert.equal(result.documents[0].usedForExtraction, false);
  assert.match(result.documents[0].note, /manual entry may be required/i);
  assert.equal(result.extractionMeta.localTextFilesCount, 0);
  assert.equal(result.extractionMeta.filesWithoutLocalTextCount, 1);

  assert.equal(result.paymentRecord.merged.bankSwiftCode, "");
  assert.equal(result.paymentRecord.merged.beneficiaryAccountNumber, "");
  assert.equal(result.paymentRecord.merged.currency, "SGD");
  assert.equal(result.extractionMeta.currencyExtracted, false);
  assert.ok(Number.isFinite(result.extractionMeta.totalExtractionMs));

  assert.deepEqual(result.extractionMeta.missingFieldsAfterLocalParser.sort(), [
    "amount",
    "bankSwiftCode",
    "beneficiaryAccountNumber",
    "beneficiaryName",
    "invoiceNumber",
  ]);

  if (result.extractionMeta.finalProvider === "local_parser_plus_openai") {
    assert.ok(result.paymentRecord.merged.invoiceNumber);
    assert.ok(result.paymentRecord.merged.amount);
    assert.ok(result.paymentRecord.merged.beneficiaryName);
    assert.equal(result.extractionMeta.openAiReason, "used_openai");
  } else {
    assert.equal(result.paymentRecord.merged.invoiceNumber, "");
    assert.equal(result.paymentRecord.merged.amount, "");
    assert.equal(result.paymentRecord.merged.beneficiaryName, "");
    assert.ok(
      ["local_parser_only", "local_parser_plus_openai"].includes(result.extractionMeta.finalProvider)
    );
  }
});
