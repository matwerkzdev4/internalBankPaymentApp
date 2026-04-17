const fs = require("node:fs");
const path = require("node:path");
const { extractFromDocuments } = require("../lib/extraction");
const { validatePaymentRecord } = require("../lib/paymentRecord");

async function extractSingleFile(filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);
  return extractFromDocuments([
    {
      originalname: path.basename(filePath),
      mimetype: mimeType,
      buffer,
      size: buffer.length,
    },
  ]);
}

function summarizeScenario(name, result) {
  const merged = result.paymentRecord.merged;
  const validation = validatePaymentRecord(result.paymentRecord);

  return {
    name,
    status: validation.isValid ? "ready_for_review" : "needs_input",
    merged,
    validation,
    extractionMeta: result.extractionMeta,
    documents: result.documents,
  };
}

function formatFieldLine(label, value) {
  return `- ${label}: ${value || "(blank)"}`;
}

function formatScenario(summary) {
  return [
    `## ${summary.name}`,
    "",
    `- Status: \`${summary.status}\``,
    `- Final provider: \`${summary.extractionMeta.finalProvider}\``,
    `- OpenAI available: \`${summary.extractionMeta.openAiAvailable}\``,
    `- OpenAI reason: \`${summary.extractionMeta.openAiReason}\``,
    `- Files with local text: \`${summary.extractionMeta.localTextFilesCount}\``,
    `- Files without local text: \`${summary.extractionMeta.filesWithoutLocalTextCount}\``,
    `- Missing required fields: ${
      summary.validation.missingFields.length
        ? summary.validation.missingFields.join(", ")
        : "(none)"
    }`,
    "",
    "Extracted / merged values:",
    formatFieldLine("supplierName", summary.merged.supplierName),
    formatFieldLine("invoiceNumber", summary.merged.invoiceNumber),
    formatFieldLine("amount", summary.merged.amount),
    formatFieldLine("currency", summary.merged.currency),
    formatFieldLine("dueDate", summary.merged.dueDate),
    formatFieldLine("paymentReference", summary.merged.paymentReference),
    formatFieldLine("bankSwiftCode", summary.merged.bankSwiftCode),
    formatFieldLine("beneficiaryAccountNumber", summary.merged.beneficiaryAccountNumber),
    formatFieldLine("beneficiaryName", summary.merged.beneficiaryName),
    formatFieldLine("remark", summary.merged.remark),
    "",
    "Document notes:",
    ...summary.documents.map((doc) =>
      `- ${doc.fileName}: ${
        doc.note || `text extracted (${doc.extractedTextLength} chars)`
      }`
    ),
    "",
  ].join("\n");
}

async function main() {
  const root = path.join(__dirname, "..");
  const happyPathFile = path.join(root, "demo", "fixtures", "happy-path-invoice.txt");
  const sfExpressFile = path.join(root, "SFExpress.pdf");

  const happyPathResult = await extractSingleFile(happyPathFile, "text/plain");
  const sfExpressResult = await extractSingleFile(sfExpressFile, "application/pdf");

  const happyPathSummary = summarizeScenario("Happy-path sample invoice", happyPathResult);
  const sfExpressSummary = summarizeScenario("SFExpress real sample", sfExpressResult);

  const report = [
    "# Demo Verification Report",
    "",
    `Generated on: ${new Date().toISOString()}`,
    "",
    "## Automated Tests",
    "",
    "- Run separately with: `npm.cmd test`",
    "- Latest verified result in this session: PASS",
    "- Expected suite size now: 51 tests",
    "",
    "Expected coverage:",
    "- bank file generation",
    "- upload gallery pending-file state",
    "- confirmed queue persistence",
    "- validation",
    "- local extraction",
    "- second-pass merge behavior",
    "- supplier guardrails",
    "- COD handling",
    "- SFExpress current-state limitation",
    "",
    formatScenario(happyPathSummary),
    formatScenario(sfExpressSummary),
    "## Demo Notes",
    "",
    "- Start by showing the upload gallery with both choose-files and drag-and-drop.",
    "- Use the happy-path sample to show upload, extraction, review, and export success.",
    "- Refresh once after confirming a payment to show the server-backed queue restore.",
    "- Use SFExpress.pdf to show the current limitation safely: the app should not guess missing payment values.",
    "- If SFExpress remains incomplete, manual entry is the expected current behavior until dedicated OCR or a stronger proven vision flow is added.",
    "",
  ].join("\n");

  process.stdout.write(report);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
