const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getExtractionSourceLabel,
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
