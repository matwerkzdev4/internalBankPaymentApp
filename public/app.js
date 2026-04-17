const uploadForm = typeof document !== "undefined" ? document.getElementById("uploadForm") : null;
const reviewForm = typeof document !== "undefined" ? document.getElementById("reviewForm") : null;
const confirmButton = typeof document !== "undefined" ? document.getElementById("confirmButton") : null;
const resetButton = typeof document !== "undefined" ? document.getElementById("resetButton") : null;
const statusBanner = typeof document !== "undefined" ? document.getElementById("statusBanner") : null;
const missingFields = typeof document !== "undefined" ? document.getElementById("missingFields") : null;
const rowPreview = typeof document !== "undefined" ? document.getElementById("rowPreview") : null;
const extractionEvidence = typeof document !== "undefined" ? document.getElementById("extractionEvidence") : null;
const queueList = typeof document !== "undefined" ? document.getElementById("queueList") : null;
const queueSummary = typeof document !== "undefined" ? document.getElementById("queueSummary") : null;
const currencyWarning = typeof document !== "undefined" ? document.getElementById("currencyWarning") : null;
const fileInput = typeof document !== "undefined" ? document.getElementById("documents") : null;

let currentRecord = { extracted: {}, corrected: {}, merged: {} };
let confirmedRecords = [];
let requiredFields = [];
let latestExtractionMeta = {};
const MAX_UPLOAD_DOCUMENTS = 5;
const supportedTextExtensions = new Set(["txt", "md"]);
const supportedImageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"]);
const supportedImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
]);
const supportedDocMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const fieldNames = [
  "supplierName",
  "invoiceNumber",
  "amount",
  "currency",
  "dueDate",
  "paymentReference",
  "bankSwiftCode",
  "beneficiaryAccountNumber",
  "beneficiaryName",
  "remark",
];

function getFileExtension(file = {}) {
  const name = String(file.fileName || file.name || "").toLowerCase();
  if (!name.includes(".")) {
    return "";
  }

  return name.split(".").pop();
}

function isSupportedUploadFile(file = {}) {
  const extension = getFileExtension(file);
  const type = String(file.type || file.mimetype || "").toLowerCase();

  if (extension === "pdf" || supportedDocMimeTypes.has(type) && type === "application/pdf") {
    return true;
  }

  if (supportedTextExtensions.has(extension) || type.startsWith("text/")) {
    return true;
  }

  if (extension === "docx" || supportedDocMimeTypes.has(type)) {
    return true;
  }

  if (supportedImageExtensions.has(extension) || supportedImageMimeTypes.has(type)) {
    return true;
  }

  return false;
}

function getUploadLimitMessage() {
  return `Upload up to ${MAX_UPLOAD_DOCUMENTS} documents at one time. More files may slow extraction.`;
}

function getUnsupportedFileMessage() {
  return "Unsupported file type. Upload TXT, MD, PDF, DOCX, or common image files such as PNG, JPG, JPEG, WEBP, GIF, BMP, TIF, and TIFF.";
}

function setStatus(message, type = "muted") {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
}

function setFormValues(values = {}) {
  for (const fieldName of fieldNames) {
    reviewForm.elements[fieldName].value = values[fieldName] ?? "";
  }
}

function getCorrectedValues() {
  const corrected = {};
  for (const fieldName of fieldNames) {
    corrected[fieldName] = reviewForm.elements[fieldName].value;
  }
  return corrected;
}

function applyValidation(missing = []) {
  missingFields.textContent = missing.length
    ? `Fill in these required fields before confirming: ${missing.join(", ")}`
    : "All required fields are ready for confirmation.";

  for (const fieldName of fieldNames) {
    const input = reviewForm.elements[fieldName];
    input.classList.toggle("missing", missing.includes(fieldName));
  }
}

function formatExtractionTime(value) {
  const totalMs = Number(value);
  if (!Number.isFinite(totalMs) || totalMs < 0) {
    return "not available";
  }

  return `${(totalMs / 1000).toFixed(1)} s`;
}

function getExtractionSourceLabel(meta = {}) {
  if (meta.finalProvider === "local_parser_plus_openai") {
    return "Local parser + OpenAI";
  }

  return "Local parser only";
}

function syncCurrencyWarning(meta = {}) {
  currencyWarning.classList.toggle("hidden", Boolean(meta.currencyExtracted));
}

function renderEvidence(meta = {}, validation = { missingFields: [] }) {
  const lines = [
    `OpenAI API key available: ${meta.openAiAvailable ? "Yes" : "No"}`,
    `Provider used: ${getExtractionSourceLabel(meta)}`,
    `Currency extracted: ${meta.currencyExtracted ? "Yes" : "No"}`,
    `Missing required fields: ${validation.missingFields?.length ? "Yes" : "No"}`,
    `Time taken: ${formatExtractionTime(meta.totalExtractionMs)}`,
  ];

  extractionEvidence.textContent = lines.join("\n");
  syncCurrencyWarning(meta);
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const data = await response.json();
  requiredFields = data.requiredExportFields;
}

function updatePreview() {
  const merged = {
    ...currentRecord.merged,
    ...getCorrectedValues(),
  };

  const bankAccount = `${merged.bankSwiftCode || ""}${(merged.beneficiaryAccountNumber || "").replace(/\s+/g, "")}`;
  const amount = merged.amount ? Number(merged.amount).toFixed(2) : "";
  rowPreview.textContent =
    `Bank + account: ${bankAccount}\n` +
    `Beneficiary: ${merged.beneficiaryName || merged.supplierName || ""}\n` +
    `Amount: ${amount}\n` +
    `Remark: ${merged.remark || merged.invoiceNumber || ""}`;
}

function getCurrentPayload() {
  return {
    extracted: currentRecord.extracted,
    corrected: getCorrectedValues(),
  };
}

function getCurrentMergedRecord() {
  return {
    ...currentRecord.merged,
    ...getCorrectedValues(),
    amount: String(reviewForm.elements.amount.value || "").trim(),
    currency: window.ConfirmedQueue.normalizeCurrency(reviewForm.elements.currency.value || ""),
    bankSwiftCode: String(reviewForm.elements.bankSwiftCode.value || "").trim().toUpperCase(),
    beneficiaryAccountNumber: String(reviewForm.elements.beneficiaryAccountNumber.value || "")
      .replace(/\s+/g, "")
      .trim(),
  };
}

async function saveQueueToServer(records = []) {
  const response = await fetch("/api/queue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Queue save failed.");
  }

  return Array.isArray(data.records) ? data.records : [];
}

async function loadQueueFromServer() {
  const response = await fetch("/api/queue");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Queue load failed.");
  }

  return Array.isArray(data.records) ? data.records : [];
}

function renderQueue() {
  queueList.innerHTML = "";
  const groupedQueues = window.ConfirmedQueue.groupRecordsByCurrency(confirmedRecords);
  queueSummary.textContent = confirmedRecords.length
    ? `${confirmedRecords.length} confirmed payment${confirmedRecords.length === 1 ? "" : "s"} across ${groupedQueues.length} currency queue${groupedQueues.length === 1 ? "" : "s"}`
    : "No confirmed payments yet";

  groupedQueues.forEach((group) => {
    const section = document.createElement("section");
    section.className = "currency-queue";

    const header = document.createElement("div");
    header.className = "currency-queue-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "currency-queue-title";
    title.textContent = `${group.currency} queue`;

    const meta = document.createElement("p");
    meta.className = "currency-queue-meta";
    meta.textContent = `${group.items.length} confirmed payment${group.items.length === 1 ? "" : "s"} ready for export`;
    titleWrap.append(title, meta);

    const exportCurrencyButton = document.createElement("button");
    exportCurrencyButton.type = "button";
    exportCurrencyButton.className = "primary currency-export";
    exportCurrencyButton.textContent = `Export ${group.currency} .txt file`;
    exportCurrencyButton.addEventListener("click", () => {
      exportCurrencyQueue(group.currency);
    });

    header.append(titleWrap, exportCurrencyButton);

    const items = document.createElement("ul");
    items.className = "currency-queue-items";

    group.items.forEach((record) => {
      const index = record.sourceIndex;
      const item = document.createElement("li");
      item.className = "queue-item";

      const summary = document.createElement("div");
      summary.className = "queue-item-summary";
      summary.textContent =
        `${record.invoiceNumber || "(no invoice number)"} | ` +
        `${record.beneficiaryName || record.supplierName || "(no beneficiary)"} | ` +
        `${record.amount || "(no amount)"} ${group.currency} | ` +
        `${record.bankSwiftCode || ""}${record.beneficiaryAccountNumber || ""} | ` +
        `${record.remark || "(no remark)"}`;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "ghost queue-remove";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", async () => {
        confirmedRecords = confirmedRecords.filter((_, recordIndex) => recordIndex !== index);
        try {
          confirmedRecords = await saveQueueToServer(confirmedRecords);
        } catch (error) {
          setStatus("The payment was removed locally, but the server queue could not be updated.", "warn");
        }
        renderQueue();
        if (!statusBanner.classList.contains("warn")) {
          setStatus(
            confirmedRecords.length
              ? `Confirmed payment removed from the ${group.currency} queue.`
              : "Confirmed payment removed. The queue is now empty.",
            "muted"
          );
        }
      });

      item.append(summary, removeButton);
      items.appendChild(item);
    });

    section.append(header, items);
    queueList.appendChild(section);
  });
}

function clearCurrentForm() {
  uploadForm.reset();
  reviewForm.reset();
  currentRecord = { extracted: {}, corrected: {}, merged: {} };
  latestExtractionMeta = {};
  missingFields.textContent = "";
  extractionEvidence.textContent = "No extraction evidence yet";
  rowPreview.textContent = "No payment row yet";
  syncCurrencyWarning({});
  applyValidation([]);
}

function getQueuedDuplicateMessage(record = {}) {
  return (
    "This invoice is already in the confirmed queue for this session: " +
    `${record.invoiceNumber || "(no invoice number)"} | ` +
    `${record.supplierName || "(no supplier)"} | ` +
    `${record.amount || "(no amount)"}. Remove the queued item first if you want to add it again.`
  );
}

if (uploadForm && reviewForm && confirmButton && resetButton && fileInput) {

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedFiles = Array.from(fileInput.files || []);

  if (!selectedFiles.length) {
    setStatus("Choose at least one document before extraction.", "warn");
    return;
  }

  if (selectedFiles.length > MAX_UPLOAD_DOCUMENTS) {
    setStatus(getUploadLimitMessage(), "warn");
    return;
  }

  if (selectedFiles.some((file) => !isSupportedUploadFile(file))) {
    setStatus(getUnsupportedFileMessage(), "warn");
    return;
  }

  setStatus("Extracting details from your documents...", "muted");

  const formData = new FormData();
  for (const file of selectedFiles) {
    formData.append("documents", file);
  }

  const response = await fetch("/api/extract", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Extraction failed.", "warn");
    return;
  }

  currentRecord = data.paymentRecord;
  latestExtractionMeta = data.extractionMeta || {};
  setFormValues(currentRecord.merged);
  renderEvidence(latestExtractionMeta, data.validation);
  applyValidation(data.validation.missingFields);
  updatePreview();
  const queuedDuplicate = window.ConfirmedQueue.findQueuedDuplicate(currentRecord.merged, confirmedRecords);
  setStatus(
    queuedDuplicate
      ? getQueuedDuplicateMessage(currentRecord.merged)
      : data.validation.isValid
        ? "Ready for review. Confirm this payment to add it to the list."
        : "Details found. Fill the missing fields before confirming this payment.",
    queuedDuplicate ? "warn" : data.validation.isValid ? "ready" : "warn"
  );
});

async function exportCurrencyQueue(currency) {
  const recordsForCurrency = confirmedRecords.filter(
    (record) => window.ConfirmedQueue.normalizeCurrency(record.currency) === currency
  );

  if (!recordsForCurrency.length) {
    setStatus(`No confirmed ${currency} payments are ready for export.`, "warn");
    return;
  }

  const response = await fetch("/api/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: recordsForCurrency.map((record) => ({
        corrected: record,
      })),
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    applyValidation(data.validation?.missingFields || []);
    setStatus(data.error || `${currency} export failed.`, "warn");
    return;
  }

  const blob = await response.blob();
  const fileName = response.headers
    .get("Content-Disposition")
    ?.match(/filename=\"(.+)\"/)?.[1] || "payment.txt";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.replace(".txt", `-${currency.toLowerCase()}.txt`);
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(`Bank payment file is ready for the ${currency} queue.`, "ready");
}

reviewForm.addEventListener("input", () => {
  const corrected = getCorrectedValues();
  const missing = requiredFields.filter((fieldName) => !String(corrected[fieldName] || "").trim());
  applyValidation(missing);
  updatePreview();
});

confirmButton.addEventListener("click", async () => {
  const mergedRecord = getCurrentMergedRecord();
  const duplicateRecord = window.ConfirmedQueue.findQueuedDuplicate(mergedRecord, confirmedRecords);

  if (duplicateRecord) {
    setStatus(getQueuedDuplicateMessage(mergedRecord), "warn");
    return;
  }

  const response = await fetch("/api/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [getCurrentPayload()],
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    applyValidation(data.validation?.missingFields || []);
    setStatus(data.error || "Complete the required payment details before confirming.", "warn");
    return;
  }

  let queueSaveFailed = false;
  confirmedRecords.push(mergedRecord);
  try {
    confirmedRecords = await saveQueueToServer(confirmedRecords);
  } catch (error) {
    queueSaveFailed = true;
    setStatus(
      `${mergedRecord.currency} payment was confirmed locally, but the server queue could not be saved.`,
      "warn"
    );
  }
  renderQueue();
  renderEvidence(latestExtractionMeta, { missingFields: [] });
  applyValidation([]);
  updatePreview();
  if (queueSaveFailed) {
    return;
  }

  setStatus(
    `Payment confirmed and added to the ${mergedRecord.currency} queue. The extracted details stay here until you clear them or run the next extraction.`,
    "ready"
  );
});

resetButton.addEventListener("click", () => {
  clearCurrentForm();
  setStatus("Current form cleared. Confirmed payments remain in the list.", "muted");
});

loadConfig();
loadQueueFromServer()
  .then((records) => {
    confirmedRecords = records;
    renderQueue();
    if (confirmedRecords.length) {
      setStatus(
        `${confirmedRecords.length} confirmed payment${confirmedRecords.length === 1 ? "" : "s"} restored from the server queue.`,
        "muted"
      );
    }
  })
  .catch(() => {
    renderQueue();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getExtractionSourceLabel,
    getUnsupportedFileMessage,
    getUploadLimitMessage,
    isSupportedUploadFile,
    formatExtractionTime,
  };
}
