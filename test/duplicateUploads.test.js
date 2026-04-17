const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFileFingerprint,
  findDuplicateUploads,
} = require("../public/duplicateUploads");

test("buildFileFingerprint uses file metadata fields", () => {
  const fingerprint = buildFileFingerprint({
    name: "invoice-a.pdf",
    size: 2048,
    lastModified: 1713200000000,
    type: "application/pdf",
  });

  assert.equal(fingerprint, "invoice-a.pdf::2048::1713200000000::application/pdf");
});

test("findDuplicateUploads returns empty list when files are new", () => {
  const duplicates = findDuplicateUploads(
    [
      {
        name: "invoice-a.pdf",
        size: 2048,
        lastModified: 1713200000000,
        type: "application/pdf",
      },
    ],
    new Set()
  );

  assert.deepEqual(duplicates, []);
});

test("findDuplicateUploads flags files already seen in the current session", () => {
  const existingFingerprint = buildFileFingerprint({
    name: "invoice-a.pdf",
    size: 2048,
    lastModified: 1713200000000,
    type: "application/pdf",
  });

  const duplicates = findDuplicateUploads(
    [
      {
        name: "invoice-a.pdf",
        size: 2048,
        lastModified: 1713200000000,
        type: "application/pdf",
      },
      {
        name: "invoice-b.pdf",
        size: 4096,
        lastModified: 1713200000100,
        type: "application/pdf",
      },
    ],
    new Set([existingFingerprint])
  );

  assert.deepEqual(duplicates, [
    {
      fileName: "invoice-a.pdf",
      fingerprint: existingFingerprint,
    },
  ]);
});
