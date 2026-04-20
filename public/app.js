const uploadForm = typeof document !== "undefined" ? document.getElementById("uploadForm") : null;
const reviewForm = typeof document !== "undefined" ? document.getElementById("reviewForm") : null;
const confirmButton = typeof document !== "undefined" ? document.getElementById("confirmButton") : null;
const resetButton = typeof document !== "undefined" ? document.getElementById("resetButton") : null;
const clearSelectedFilesButton =
  typeof document !== "undefined" ? document.getElementById("clearSelectedFilesButton") : null;
const statusBanner = typeof document !== "undefined" ? document.getElementById("statusBanner") : null;
const selectedFilesSummary = typeof document !== "undefined" ? document.getElementById("selectedFilesSummary") : null;
const selectedFilesList = typeof document !== "undefined" ? document.getElementById("selectedFilesList") : null;
const sectionTwoGuidance =
  typeof document !== "undefined" ? document.getElementById("sectionTwoGuidance") : null;
const missingFields = typeof document !== "undefined" ? document.getElementById("missingFields") : null;
const rowPreview = typeof document !== "undefined" ? document.getElementById("rowPreview") : null;
const extractionEvidence = typeof document !== "undefined" ? document.getElementById("extractionEvidence") : null;
const queueList = typeof document !== "undefined" ? document.getElementById("queueList") : null;
const queueSummary = typeof document !== "undefined" ? document.getElementById("queueSummary") : null;
const payeeList = typeof document !== "undefined" ? document.getElementById("payeeList") : null;
const payeeSummary = typeof document !== "undefined" ? document.getElementById("payeeSummary") : null;
const currencyWarning = typeof document !== "undefined" ? document.getElementById("currencyWarning") : null;
const fileInput = typeof document !== "undefined" ? document.getElementById("documents") : null;
const supplierReviewPanel =
  typeof document !== "undefined" ? document.getElementById("supplierReviewPanel") : null;
const supplierReviewForm =
  typeof document !== "undefined" ? document.getElementById("supplierReviewForm") : null;
const supplierReviewTitle =
  typeof document !== "undefined" ? document.getElementById("supplierReviewTitle") : null;
const supplierReviewMessage =
  typeof document !== "undefined" ? document.getElementById("supplierReviewMessage") : null;
const supplierReviewMissingFields =
  typeof document !== "undefined" ? document.getElementById("supplierReviewMissingFields") : null;
const saveSupplierButton =
  typeof document !== "undefined" ? document.getElementById("saveSupplierButton") : null;
const exportSupplierMasterButton =
  typeof document !== "undefined" ? document.getElementById("exportSupplierMasterButton") : null;
const supplierMasterFileInput =
  typeof document !== "undefined" ? document.getElementById("supplierMasterFileInput") : null;
const supplierMasterSummary =
  typeof document !== "undefined" ? document.getElementById("supplierMasterSummary") : null;
const supplierMasterStatus =
  typeof document !== "undefined" ? document.getElementById("supplierMasterStatus") : null;
const onboardingCard =
  typeof document !== "undefined" ? document.getElementById("onboardingCard") : null;
const dismissOnboardingButton =
  typeof document !== "undefined" ? document.getElementById("dismissOnboardingButton") : null;
const extractionProgress =
  typeof document !== "undefined" ? document.getElementById("extractionProgress") : null;
const supplierCheckNotice =
  typeof document !== "undefined" ? document.getElementById("supplierCheckNotice") : null;

let currentRecord = { extracted: {}, corrected: {}, merged: {} };
let confirmedRecords = [];
let requiredFields = [];
let latestExtractionMeta = {};
let selectedFilesQueue = [];
let sessionNewSupplierKeys = new Set();
let supplierReviewRequired = false;
let latestSupplierResolution = {
  matchStatus: "cannot_match",
  matched: false,
  supplier: null,
  normalizedSupplierKey: null,
};
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
const supplierFieldNames = [
  "supplierName",
  "beneficiaryName",
  "bankSwiftCode",
  "beneficiaryAccountNumber",
  "paymentReference",
];
const onboardingStorageKey = "bank-payment-tool-hide-quick-start";
const fieldLabels = {
  supplierName: "supplier name",
  invoiceNumber: "invoice number",
  amount: "amount",
  currency: "currency code",
  dueDate: "due date",
  paymentReference: "payment reference",
  bankSwiftCode: "beneficiary bank code / SWIFT",
  beneficiaryAccountNumber: "beneficiary account number",
  beneficiaryName: "beneficiary name",
  remark: "remark",
};

function normalizeSupplierLookupKey(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeQueueCurrency(value = "") {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized) {
    return "SGD";
  }

  return normalized === "CNY" ? "RMB" : normalized;
}

function attachSessionNewSupplierFlags(records = [], newSupplierKeys = sessionNewSupplierKeys) {
  return records.map((record) => {
    const normalizedSupplierKey =
      normalizeSupplierLookupKey(record.normalizedSupplierKey || record.supplierName) || null;

    return {
      ...record,
      normalizedSupplierKey,
      isNewSupplierPayee: Boolean(normalizedSupplierKey && newSupplierKeys.has(normalizedSupplierKey)),
    };
  });
}

function buildNewSupplierPayeeGroups(records = []) {
  const uniquePayees = new Map();

  records
    .filter((record) => record.isNewSupplierPayee)
    .forEach((record) => {
      const currency = normalizeQueueCurrency(record.currency);
      const normalizedSupplierKey = normalizeSupplierLookupKey(record.normalizedSupplierKey || record.supplierName);
      const payeeKey = `${currency}::${normalizedSupplierKey}`;

      if (!normalizedSupplierKey || uniquePayees.has(payeeKey)) {
        return;
      }

      uniquePayees.set(payeeKey, {
        ...record,
        currency,
        normalizedSupplierKey,
      });
    });

  const grouped = new Map();

  Array.from(uniquePayees.values()).forEach((record, index) => {
    if (!grouped.has(record.currency)) {
      grouped.set(record.currency, []);
    }

    grouped.get(record.currency).push({
      ...record,
      sourceIndex: index,
    });
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, items]) => ({
      currency,
      items,
    }));
}

function formatFileNameDatePart(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function formatFileNameTimePart(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}${minutes}`;
}

function buildNewSupplierPayeeExportFileName(currency = "", itemCount = 0, date = new Date()) {
  const safeCurrency = normalizeQueueCurrency(currency || "SGD");
  const safeCount = Math.max(0, Number.parseInt(itemCount, 10) || 0);
  return `${safeCurrency}_new-payees_${formatFileNameDatePart(date)}_${formatFileNameTimePart(date)}_${safeCount}.txt`;
}

function buildNewSupplierPayeeExportText(records = [], currency = "") {
  const normalizedCurrency = normalizeQueueCurrency(currency || records[0]?.currency || "SGD");
  const header = [
    `New Supplier/Payee List - ${normalizedCurrency}`,
    "",
  ];

  const lines = records.map((record, index) => {
    return [
      `${index + 1}. Supplier name: ${record.supplierName || ""}`,
      `Beneficiary name: ${record.beneficiaryName || ""}`,
      `Beneficiary bank identifier / SWIFT: ${record.bankSwiftCode || ""}`,
      `Beneficiary account number: ${record.beneficiaryAccountNumber || ""}`,
      `Default payment reference: ${record.paymentReference || ""}`,
      "",
    ].join("\n");
  });

  return `${header.join("\n")}${lines.join("\n")}`.trimEnd() + "\n";
}

function applySupplierDefaults(record = {}, supplier = null) {
  if (!supplier) {
    return { ...record };
  }

  const merged = { ...record };
  for (const fieldName of supplierFieldNames) {
    if (!String(merged[fieldName] || "").trim() && String(supplier[fieldName] || "").trim()) {
      merged[fieldName] = supplier[fieldName];
    }
  }

  return merged;
}

function getSupplierResolutionUiState(resolution = {}) {
  const matchStatus = resolution.matchStatus || "cannot_match";

  if (matchStatus === "matched") {
    return {
      requiresReview: false,
      title: "Supplier found in saved list",
      message: "A saved supplier profile was found and used for any missing bank details.",
      statusType: "ready",
    };
  }

  if (matchStatus === "not_found") {
    return {
      requiresReview: true,
      title: "Review and save this new supplier",
      message: "This supplier is not in the saved list yet. Save it on this device before confirming the payment.",
      statusType: "warn",
    };
  }

  return {
    requiresReview: true,
    title: "Supplier needs a clearer check",
    message: "The supplier name is too unclear to match. Confirm the supplier details before payment confirmation.",
    statusType: "warn",
  };
}

function getSupplierReviewMissingFields(values = {}) {
  const missingFields = [];

  if (!String(values.supplierName || "").trim()) {
    missingFields.push("supplierName");
  }

  if (!String(values.bankSwiftCode || "").trim()) {
    missingFields.push("bankSwiftCode");
  }

  if (!String(values.beneficiaryAccountNumber || "").replace(/\s+/g, "").trim()) {
    missingFields.push("beneficiaryAccountNumber");
  }

  return missingFields;
}

function getFieldInstruction(fieldName) {
  const label = fieldLabels[fieldName] || fieldName;
  return `Enter ${label} before confirming this payment.`;
}

function buildValidationGuidance(missing = []) {
  if (!missing.length) {
    return "Payment details are ready. Confirm the payment into the list when the supplier check is complete.";
  }

  return missing.map((fieldName) => getFieldInstruction(fieldName));
}

function normalizeCurrencyInput(value = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized) {
    return "";
  }

  return normalized === "CNY" ? "RMB" : normalized;
}

function shouldShowSupplierReview(resolution = latestSupplierResolution, values = {}) {
  const hasSupplierName = Boolean(normalizeSupplierLookupKey(values.supplierName || currentRecord?.merged?.supplierName));
  return Boolean(supplierReviewRequired && hasSupplierName && getSupplierResolutionUiState(resolution).requiresReview);
}

function setExtractionProgressVisible(isVisible) {
  if (!extractionProgress) {
    return;
  }

  extractionProgress.classList.toggle("hidden", !isVisible);
}

function setSectionTwoGuidance(message = "", type = "warn") {
  if (!sectionTwoGuidance) {
    return;
  }

  if (!message) {
    sectionTwoGuidance.textContent = "";
    return;
  }

  sectionTwoGuidance.textContent = message;
}

function updateSupplierReviewRequirement(resolution = latestSupplierResolution, supplierName = "") {
  const hasSupplierName = Boolean(normalizeSupplierLookupKey(supplierName || currentRecord?.merged?.supplierName));
  supplierReviewRequired = Boolean(hasSupplierName && resolution.matchStatus !== "matched");
  return supplierReviewRequired;
}

function setOnboardingVisibility() {
  if (!onboardingCard) {
    return;
  }

  let hideGuide = false;
  try {
    hideGuide = typeof window !== "undefined" && window.localStorage?.getItem(onboardingStorageKey) === "true";
  } catch (error) {
    hideGuide = false;
  }

  onboardingCard.classList.toggle("hidden", hideGuide);
}

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

function buildSelectedFileKey(file = {}) {
  return [
    String(file.name || file.fileName || ""),
    String(file.size || 0),
    String(file.lastModified || 0),
    String(file.type || file.mimetype || ""),
  ].join("::");
}

function mergeSelectedFiles(existingFiles = [], newFiles = []) {
  const mergedFiles = [...existingFiles];
  const seen = new Set(existingFiles.map((file) => buildSelectedFileKey(file)));
  let duplicateCount = 0;

  for (const file of newFiles) {
    const key = buildSelectedFileKey(file);
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(key);
    mergedFiles.push(file);
  }

  return {
    files: mergedFiles,
    duplicateCount,
  };
}

function getSelectedFilesSummary(fileCount) {
  return fileCount
    ? `Step 1 ready: ${fileCount} file${fileCount === 1 ? "" : "s"} selected`
    : "No files selected yet";
}

function renderSelectedFiles(files = []) {
  if (!selectedFilesSummary || !selectedFilesList) {
    return;
  }

  selectedFilesSummary.textContent = getSelectedFilesSummary(files.length);

  if (!files.length) {
    selectedFilesList.innerHTML =
      '<li class="selected-files-empty">Your selected files will appear here before reading starts.</li>';
    return;
  }

  selectedFilesList.innerHTML = "";

  files.forEach((file, index) => {
    const item = document.createElement("li");
    item.className = "selected-files-item";

    const fileName = document.createElement("span");
    fileName.className = "selected-file-name";
    fileName.textContent = String(file.name || file.fileName || "(unnamed file)");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "ghost selected-file-remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      selectedFilesQueue = selectedFilesQueue.filter((_, fileIndex) => fileIndex !== index);
      renderSelectedFiles(selectedFilesQueue);
      setStatus(
        selectedFilesQueue.length
          ? "Selected file removed from the upload queue."
          : "Selected file removed. No files remain in the upload queue.",
        "muted"
      );
    });

    item.append(fileName, removeButton);
    selectedFilesList.appendChild(item);
  });
}

function setStatus(message, type = "muted") {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
}

function setSupplierMasterStatus(message, type = "muted") {
  if (!supplierMasterStatus) {
    return;
  }

  supplierMasterStatus.textContent = message;
  supplierMasterStatus.className = `status-banner supplier-master-status ${type}`;
}

function extractDownloadFileName(contentDisposition = "", fallback = "") {
  const matchedFileName = String(contentDisposition || "").match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/i)?.[1];
  return matchedFileName || fallback;
}

async function getResponseErrorMessage(response, fallbackMessage) {
  const contentType = String(response?.headers?.get?.("Content-Type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      return data?.error || data?.details || fallbackMessage;
    } catch (error) {
      return fallbackMessage;
    }
  }

  try {
    const text = await response.text();
    return String(text || "").trim() || fallbackMessage;
  } catch (error) {
    return fallbackMessage;
  }
}

function triggerBrowserDownload(blob, fileName = "download.txt") {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("This browser cannot start the download automatically.");
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setFormValues(values = {}) {
  for (const fieldName of fieldNames) {
    reviewForm.elements[fieldName].value = values[fieldName] ?? "";
  }
}

function setSupplierReviewValues(values = {}) {
  if (!supplierReviewForm) {
    return;
  }

  for (const fieldName of supplierFieldNames) {
    supplierReviewForm.elements[fieldName].value = values[fieldName] ?? "";
  }
}

function getCorrectedValues() {
  const corrected = {};
  for (const fieldName of fieldNames) {
    corrected[fieldName] = reviewForm.elements[fieldName].value;
  }
  return corrected;
}

function getSupplierReviewValues() {
  const values = {};

  if (!supplierReviewForm) {
    return values;
  }

  for (const fieldName of supplierFieldNames) {
    values[fieldName] = supplierReviewForm.elements[fieldName].value;
  }

  return values;
}

function applyValidation(missing = []) {
  const guidance = buildValidationGuidance(missing);
  missingFields.innerHTML = guidance.map((message) => `<div>${message}</div>`).join("");

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
    `Server AI backup available: ${meta.openAiAvailable ? "Yes" : "No"}`,
    `Source used: ${getExtractionSourceLabel(meta)}`,
    `Currency found in the documents: ${meta.currencyExtracted ? "Yes" : "No"}`,
    `More operator input needed: ${validation.missingFields?.length ? "Yes" : "No"}`,
    `Reading time: ${formatExtractionTime(meta.totalExtractionMs)}`,
  ];

  extractionEvidence.textContent = lines.join("\n");
  syncCurrencyWarning(meta);
}

async function loadSupplierMasterSummary() {
  if (!supplierMasterSummary) {
    return;
  }

  try {
    const response = await fetch("/api/suppliers");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Supplier master load failed.");
    }

    const supplierCount = Array.isArray(data.records) ? data.records.length : 0;
    supplierMasterSummary.textContent = supplierCount
      ? `${supplierCount} supplier profile${supplierCount === 1 ? "" : "s"} saved on this device. Importing a supplier list JSON file will replace this local list.`
      : "0 supplier profiles saved on this device. Importing a supplier list JSON file will replace this local list.";
  } catch (error) {
    supplierMasterSummary.textContent =
      "0 supplier profiles saved on this device. Importing a supplier list JSON file will replace this local list.";
  }
}

function syncSupplierReviewUi(resolution = latestSupplierResolution) {
  if (!supplierReviewPanel || !supplierReviewTitle || !supplierReviewMessage || !confirmButton) {
    return;
  }

  const uiState = getSupplierResolutionUiState(resolution);
  const showReview = shouldShowSupplierReview(resolution, getCurrentMergedRecord());
  supplierReviewPanel.classList.toggle("hidden", !showReview);
  supplierReviewTitle.textContent = uiState.title;
  supplierReviewMessage.textContent = uiState.message;
  confirmButton.disabled = showReview;
  if (supplierCheckNotice) {
    supplierCheckNotice.classList.toggle("hidden", !showReview);
  }

  if (showReview) {
    setSectionTwoGuidance(
      "New supplier detected. Review and confirm the supplier details before adding it to the supplier master list."
    );
    if (supplierReviewMissingFields) {
      supplierReviewMissingFields.textContent =
        "Confirm the supplier details and save them to the supplier master list before confirming payment.";
    }
  } else {
    setSectionTwoGuidance("");
  }
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
    currency: normalizeCurrencyInput(reviewForm.elements.currency.value || ""),
    bankSwiftCode: String(reviewForm.elements.bankSwiftCode.value || "").trim().toUpperCase(),
    beneficiaryAccountNumber: String(reviewForm.elements.beneficiaryAccountNumber.value || "")
      .replace(/\s+/g, "")
      .trim(),
  };
}

async function resolveSupplier(record = {}) {
  const response = await fetch("/api/suppliers/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      supplierName: record.supplierName,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Supplier resolve failed.");
  }

  return data;
}

async function saveSupplierProfile(profile = {}) {
  const response = await fetch("/api/suppliers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Supplier save failed.");
  }

  return data.supplier || null;
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

  return attachSessionNewSupplierFlags(Array.isArray(data.records) ? data.records : []);
}

async function loadQueueFromServer() {
  const response = await fetch("/api/queue");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Queue load failed.");
  }

  return attachSessionNewSupplierFlags(Array.isArray(data.records) ? data.records : []);
}

function shouldConfirmHighRiskExport(currency, recordsForCurrency = []) {
  const hasNewSupplierPayees = recordsForCurrency.some((record) => record.isNewSupplierPayee);
  const hasUnclearCurrency = recordsForCurrency.some(
    (record) => !String(record.currency || "").trim() || String(record.currency || "").trim().toUpperCase() !== currency
  );
  const hasUnmatchedSupplier = recordsForCurrency.some(
    (record) => !normalizeSupplierLookupKey(record.normalizedSupplierKey || record.supplierName)
  );

  const warnings = [];
  if (hasNewSupplierPayees) {
    warnings.push(`new payees exist in the ${currency} queue`);
  }
  if (hasUnclearCurrency) {
    warnings.push("one or more payments have unusual currency data");
  }
  if (hasUnmatchedSupplier) {
    warnings.push("one or more payments do not have a clear supplier key");
  }

  if (!warnings.length || typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }

  return window.confirm(
    `Please double-check before export: ${warnings.join(", ")}. Continue exporting the ${currency} bank file?`
  );
}

async function exportCurrencyQueue(currency) {
  const recordsForCurrency = confirmedRecords.filter(
    (record) => window.ConfirmedQueue.normalizeCurrency(record.currency) === currency
  );

  if (!recordsForCurrency.length) {
    setStatus(`No confirmed ${currency} payments are ready for export.`, "warn");
    return;
  }

  const hasNewSupplierPayees = recordsForCurrency.some((record) => record.isNewSupplierPayee);
  if (!shouldConfirmHighRiskExport(currency, recordsForCurrency)) {
    setStatus(`Export stopped. Review the ${currency} queue before exporting.`, "warn");
    return;
  }

  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currency,
        records: recordsForCurrency.map((record) => ({
          corrected: record,
        })),
      }),
    });

    if (!response.ok) {
      const errorMessage = await getResponseErrorMessage(response, `${currency} export failed.`);
      setStatus(errorMessage, "warn");
      return;
    }

    const blob = await response.blob();
    const fileName = extractDownloadFileName(
      response.headers.get("Content-Disposition"),
      `${currency}_payment.txt`
    );
    triggerBrowserDownload(blob, fileName);
    setStatus(
      hasNewSupplierPayees
        ? `Export completed: ${fileName}. New payees are still in the ${currency} setup list, so create them in the bank application before processing payment.`
        : `Export completed: ${fileName}`,
      "ready"
    );
  } catch (error) {
    setStatus(error.message || `${currency} export failed.`, "warn");
  }
}

function exportNewSupplierPayeeQueue(currency) {
  const groupedPayees = buildNewSupplierPayeeGroups(confirmedRecords);
  const payeeGroup = groupedPayees.find((group) => group.currency === normalizeQueueCurrency(currency));

  if (!payeeGroup || !payeeGroup.items.length) {
    setStatus(`No new supplier/payee items are ready for export in the ${currency} Queue.`, "warn");
    return;
  }

  try {
    const fileName = buildNewSupplierPayeeExportFileName(payeeGroup.currency, payeeGroup.items.length);
    const fileContent = buildNewSupplierPayeeExportText(payeeGroup.items, payeeGroup.currency);
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    triggerBrowserDownload(blob, fileName);
    setStatus(`New supplier/payee export completed: ${fileName}`, "ready");
  } catch (error) {
    setStatus(error.message || `${currency} new supplier/payee export failed.`, "warn");
  }
}

function renderQueue() {
  queueList.innerHTML = "";
  const groupedQueues = window.ConfirmedQueue.groupRecordsByCurrency(confirmedRecords);
  queueSummary.textContent = confirmedRecords.length
    ? `Step 3 ready: ${confirmedRecords.length} confirmed payment${confirmedRecords.length === 1 ? "" : "s"} across ${groupedQueues.length} currency queue${groupedQueues.length === 1 ? "" : "s"}`
    : "No confirmed payments yet. Confirm a payment in step 2 to build the export list.";

  groupedQueues.forEach((group) => {
    const section = document.createElement("section");
    section.className = "currency-queue";

    const header = document.createElement("div");
    header.className = "currency-queue-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "currency-queue-title";
    title.textContent = `${group.currency} export queue`;

    const meta = document.createElement("p");
    meta.className = "currency-queue-meta";
    meta.textContent = `${group.items.length} confirmed payment${group.items.length === 1 ? "" : "s"} ready to export`;
    titleWrap.append(title, meta);

    const exportCurrencyButton = document.createElement("button");
    exportCurrencyButton.type = "button";
    exportCurrencyButton.className = "primary currency-export";
    exportCurrencyButton.textContent = `Export ${group.currency} bank file`;
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
        renderNewSupplierPayeeList();
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

function renderNewSupplierPayeeList() {
  if (!payeeList || !payeeSummary) {
    return;
  }

  payeeList.innerHTML = "";
  const groupedPayees = buildNewSupplierPayeeGroups(confirmedRecords);
  payeeSummary.textContent = groupedPayees.length
    ? `Step 4 attention: ${groupedPayees.reduce((count, group) => count + group.items.length, 0)} new supplier/payee item${groupedPayees.reduce((count, group) => count + group.items.length, 0) === 1 ? "" : "s"} across ${groupedPayees.length} currency queue${groupedPayees.length === 1 ? "" : "s"}`
    : "No new supplier/payee items yet. This list stays empty when all suppliers already exist.";

  groupedPayees.forEach((group) => {
    const section = document.createElement("section");
    section.className = "currency-queue";

    const header = document.createElement("div");
    header.className = "currency-queue-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "currency-queue-title";
    title.textContent = `${group.currency} payee setup queue`;

    const meta = document.createElement("p");
    meta.className = "currency-queue-meta";
    meta.textContent = `${group.items.length} new supplier/payee item${group.items.length === 1 ? "" : "s"} to set up in the bank application`;
    titleWrap.append(title, meta);

    const exportCurrencyButton = document.createElement("button");
    exportCurrencyButton.type = "button";
    exportCurrencyButton.className = "primary currency-export";
    exportCurrencyButton.textContent = `Export ${group.currency} payee list`;
    exportCurrencyButton.addEventListener("click", () => {
      exportNewSupplierPayeeQueue(group.currency);
    });

    header.append(titleWrap, exportCurrencyButton);

    const items = document.createElement("ul");
    items.className = "currency-queue-items";

    group.items.forEach((record) => {
      const item = document.createElement("li");
      item.className = "queue-item";

      const summary = document.createElement("div");
      summary.className = "queue-item-summary";
      summary.textContent =
        `${record.supplierName || "(no supplier)"} | ` +
        `${record.beneficiaryName || "(no beneficiary)"} | ` +
        `${record.bankSwiftCode || "(no SWIFT)"} | ` +
        `${record.beneficiaryAccountNumber || "(no account number)"} | ` +
        `${record.paymentReference || "(no default payment reference)"}`;

      item.appendChild(summary);
      items.appendChild(item);
    });

    section.append(header, items);
    payeeList.appendChild(section);
  });
}

function clearCurrentForm() {
  uploadForm.reset();
  reviewForm.reset();
  currentRecord = { extracted: {}, corrected: {}, merged: {} };
  latestExtractionMeta = {};
  supplierReviewRequired = false;
  latestSupplierResolution = {
    matchStatus: "cannot_match",
    matched: false,
    supplier: null,
    normalizedSupplierKey: null,
  };
  selectedFilesQueue = [];
  if (supplierReviewForm) {
    supplierReviewForm.reset();
  }
  renderSelectedFiles(selectedFilesQueue);
  setSectionTwoGuidance("");
  if (supplierReviewMissingFields) {
    supplierReviewMissingFields.textContent = "";
  }
  extractionEvidence.textContent = "No extraction evidence yet";
  rowPreview.textContent = "No payment row yet";
  setExtractionProgressVisible(false);
  syncCurrencyWarning({});
  supplierReviewPanel.classList.add("hidden");
  if (supplierCheckNotice) {
    supplierCheckNotice.classList.add("hidden");
  }
  confirmButton.disabled = false;
  applyValidation([]);
}

function getQueuedDuplicateMessage(record = {}) {
  return (
    "This invoice is already in the confirmed payment list for this session: " +
    `${record.invoiceNumber || "(no invoice number)"} | ` +
    `${record.supplierName || "(no supplier)"} | ` +
    `${record.amount || "(no amount)"}. Remove the existing item first if you want to add it again.`
  );
}

if (dismissOnboardingButton) {
  dismissOnboardingButton.addEventListener("click", () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(onboardingStorageKey, "true");
      }
    } catch (error) {
      // Ignore storage errors and still hide the card for this page view.
    }

    if (onboardingCard) {
      onboardingCard.classList.add("hidden");
    }
  });
}

if (
  uploadForm &&
  reviewForm &&
  confirmButton &&
  resetButton &&
  fileInput &&
  clearSelectedFilesButton &&
  supplierReviewForm &&
  saveSupplierButton &&
  exportSupplierMasterButton &&
  supplierMasterFileInput
) {
fileInput.addEventListener("change", () => {
  const nextFiles = Array.from(fileInput.files || []);
  if (!nextFiles.length) {
    return;
  }

  if (nextFiles.some((file) => !isSupportedUploadFile(file))) {
    setStatus(getUnsupportedFileMessage(), "warn");
    fileInput.value = "";
    return;
  }

  const mergedSelection = mergeSelectedFiles(selectedFilesQueue, nextFiles);
  if (mergedSelection.files.length > MAX_UPLOAD_DOCUMENTS) {
    setStatus(getUploadLimitMessage(), "warn");
    fileInput.value = "";
    return;
  }

  selectedFilesQueue = mergedSelection.files;
  renderSelectedFiles(selectedFilesQueue);
  setStatus(
    mergedSelection.duplicateCount
      ? `${getSelectedFilesSummary(selectedFilesQueue.length)}. ${mergedSelection.duplicateCount} duplicate file${mergedSelection.duplicateCount === 1 ? "" : "s"} ignored.`
      : getSelectedFilesSummary(selectedFilesQueue.length),
    "muted"
  );
  fileInput.value = "";
});

clearSelectedFilesButton.addEventListener("click", () => {
  selectedFilesQueue = [];
  fileInput.value = "";
  renderSelectedFiles(selectedFilesQueue);
  setStatus("Selected files cleared. Step 1 is waiting for documents again.", "muted");
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedFiles = [...selectedFilesQueue];

  if (!selectedFiles.length) {
    setStatus("Choose at least one document before reading payment details.", "warn");
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

  setStatus("Reading payment details from your documents...", "muted");
  setExtractionProgressVisible(true);

  const formData = new FormData();
  for (const file of selectedFiles) {
    formData.append("documents", file);
  }

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Extraction failed.", "warn");
      return;
    }

    selectedFilesQueue = [];
    fileInput.value = "";
    renderSelectedFiles(selectedFilesQueue);
    currentRecord = data.paymentRecord;
    latestExtractionMeta = data.extractionMeta || {};
    let mergedValues = currentRecord.merged;

    try {
      latestSupplierResolution = await resolveSupplier(mergedValues);
    } catch (error) {
      latestSupplierResolution = {
        matchStatus: "cannot_match",
        matched: false,
        supplier: null,
        normalizedSupplierKey: normalizeSupplierLookupKey(mergedValues.supplierName) || null,
      };
    }

    mergedValues = applySupplierDefaults(mergedValues, latestSupplierResolution.supplier);
    currentRecord.merged = mergedValues;
    updateSupplierReviewRequirement(latestSupplierResolution, mergedValues.supplierName);
    setFormValues(mergedValues);
    setSupplierReviewValues(mergedValues);
    renderEvidence(latestExtractionMeta, data.validation);
    applyValidation(data.validation.missingFields);
    if (supplierReviewMissingFields) {
      supplierReviewMissingFields.textContent = "";
    }
    syncSupplierReviewUi(latestSupplierResolution);
    updatePreview();
    const queuedDuplicate = window.ConfirmedQueue.findQueuedDuplicate(currentRecord.merged, confirmedRecords);
    const supplierUiState = getSupplierResolutionUiState(latestSupplierResolution);
    const statusMessage = queuedDuplicate
      ? getQueuedDuplicateMessage(currentRecord.merged)
      : latestSupplierResolution.matchStatus === "matched"
        ? "Step 2 ready. A saved supplier was found and used for any missing bank details."
        : latestSupplierResolution.matchStatus === "not_found"
          ? "New supplier found. Review and save the supplier before payment confirmation."
          : "Supplier name is unclear. Confirm the supplier details before payment confirmation.";
    setStatus(
      queuedDuplicate
        ? statusMessage
        : supplierUiState.requiresReview
          ? statusMessage
          : data.validation.isValid
            ? statusMessage
            : "Details found. Follow the step 2 instructions before confirming this payment.",
      queuedDuplicate ? "warn" : supplierUiState.statusType
    );
  } catch (error) {
    setStatus("We could not finish extraction. Please try again.", "warn");
  } finally {
    setExtractionProgressVisible(false);
  }
});

reviewForm.addEventListener("input", () => {
  const corrected = getCorrectedValues();
  updateSupplierReviewRequirement(latestSupplierResolution, corrected.supplierName);
  const missing = requiredFields.filter((fieldName) => !String(corrected[fieldName] || "").trim());
  applyValidation(missing);
  setSupplierReviewValues({
    ...getSupplierReviewValues(),
    ...corrected,
  });
  syncSupplierReviewUi(latestSupplierResolution);
  updatePreview();
});

reviewForm.elements.currency.addEventListener("blur", () => {
  const normalized = normalizeCurrencyInput(reviewForm.elements.currency.value || "");
  if (normalized) {
    reviewForm.elements.currency.value = normalized;
    updatePreview();
  }
});

reviewForm.elements.supplierName.addEventListener("blur", async () => {
  const supplierName = String(reviewForm.elements.supplierName.value || "").trim();
  if (!supplierName) {
    latestSupplierResolution = {
      matchStatus: "cannot_match",
      matched: false,
      supplier: null,
      normalizedSupplierKey: null,
    };
    updateSupplierReviewRequirement(latestSupplierResolution, "");
    syncSupplierReviewUi(latestSupplierResolution);
    return;
  }

  try {
    latestSupplierResolution = await resolveSupplier({ supplierName });
  } catch (error) {
    latestSupplierResolution = {
      matchStatus: "cannot_match",
      matched: false,
      supplier: null,
      normalizedSupplierKey: normalizeSupplierLookupKey(supplierName) || null,
    };
  }

  updateSupplierReviewRequirement(latestSupplierResolution, supplierName);
  syncSupplierReviewUi(latestSupplierResolution);
});

supplierReviewForm.addEventListener("input", () => {
  if (supplierReviewMissingFields) {
    const missing = getSupplierReviewMissingFields(getSupplierReviewValues());
    supplierReviewMissingFields.textContent = missing.length
      ? buildValidationGuidance(missing).join(" ")
      : "Supplier profile is ready to save on this device.";
  }
});

saveSupplierButton.addEventListener("click", async () => {
  const supplierProfile = getSupplierReviewValues();
  const missing = getSupplierReviewMissingFields(supplierProfile);

  if (supplierReviewMissingFields) {
    supplierReviewMissingFields.textContent = missing.length
      ? buildValidationGuidance(missing).join(" ")
      : "";
  }

  if (missing.length) {
    setStatus(
      "This supplier cannot be saved yet. Add the supplier name, beneficiary bank code / SWIFT, and beneficiary account number.",
      "warn"
    );
    return;
  }

  try {
    const savedSupplier = await saveSupplierProfile(supplierProfile);
    const wasNewSupplier = latestSupplierResolution.matchStatus !== "matched";
    latestSupplierResolution = {
      matchStatus: "matched",
      matched: true,
      supplier: savedSupplier,
      normalizedSupplierKey: savedSupplier?.normalizedSupplierKey || normalizeSupplierLookupKey(savedSupplier?.supplierName),
    };
    updateSupplierReviewRequirement(latestSupplierResolution, savedSupplier?.supplierName);
    if (wasNewSupplier && latestSupplierResolution.normalizedSupplierKey) {
      sessionNewSupplierKeys.add(latestSupplierResolution.normalizedSupplierKey);
    }
    const nextMerged = applySupplierDefaults(getCurrentMergedRecord(), savedSupplier);
    currentRecord.merged = nextMerged;
    setFormValues(nextMerged);
    setSupplierReviewValues(nextMerged);
    syncSupplierReviewUi(latestSupplierResolution);
    updatePreview();
    if (supplierReviewMissingFields) {
      supplierReviewMissingFields.textContent = "Supplier saved. You can now confirm the payment.";
    }
    loadSupplierMasterSummary();
    setStatus("Supplier saved to this device. You can now continue with payment confirmation.", "ready");
  } catch (error) {
    setStatus(error.message || "Supplier save failed.", "warn");
  }
});

exportSupplierMasterButton.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/suppliers/export");
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Supplier master export failed.");
    }

    const blob = await response.blob();
    const fileName = extractDownloadFileName(
      response.headers.get("Content-Disposition"),
      "supplier-master-list.json"
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setSupplierMasterStatus(`Supplier list export completed: ${fileName}`, "ready");
  } catch (error) {
    setSupplierMasterStatus(error.message || "Supplier list export failed.", "warn");
  }
});

supplierMasterFileInput.addEventListener("change", async () => {
  const file = supplierMasterFileInput.files?.[0];
  if (!file) {
    return;
  }

  const formData = new FormData();
  formData.append("supplierMasterFile", file);

  try {
    const response = await fetch("/api/suppliers/import", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.details || "Supplier master import failed.");
    }

    await loadSupplierMasterSummary();
    setSupplierMasterStatus(
      `Supplier list import completed: ${file.name}. ${data.importedCount || 0} supplier profile${data.importedCount === 1 ? "" : "s"} imported.`,
      "ready"
    );
  } catch (error) {
    setSupplierMasterStatus(error.message || "Supplier list import failed.", "warn");
  } finally {
    supplierMasterFileInput.value = "";
  }
});

confirmButton.addEventListener("click", async () => {
  if (supplierReviewRequired) {
    setSectionTwoGuidance(
      "New supplier detected. Review and confirm the supplier details before adding it to the supplier master list."
    );
    if (supplierCheckNotice) {
      supplierCheckNotice.classList.remove("hidden");
    }
    syncSupplierReviewUi(latestSupplierResolution);
    return;
  }

  const mergedRecord = getCurrentMergedRecord();
  mergedRecord.normalizedSupplierKey = normalizeSupplierLookupKey(mergedRecord.supplierName);
  mergedRecord.isNewSupplierPayee = Boolean(
    mergedRecord.normalizedSupplierKey && sessionNewSupplierKeys.has(mergedRecord.normalizedSupplierKey)
  );
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
  renderNewSupplierPayeeList();
  renderEvidence(latestExtractionMeta, { missingFields: [] });
  applyValidation([]);
  updatePreview();
  if (queueSaveFailed) {
    return;
  }

  setStatus(
    `Payment confirmed and added to the ${mergedRecord.currency} export queue.`,
    "ready"
  );
});

resetButton.addEventListener("click", () => {
    clearCurrentForm();
  setStatus("Current payment cleared. Confirmed payments remain in the list.", "muted");
});

renderSelectedFiles([]);
renderNewSupplierPayeeList();
setOnboardingVisibility();
loadConfig();
loadSupplierMasterSummary();
setSupplierMasterStatus("Supplier list actions will be shown here.", "muted");
loadQueueFromServer()
  .then((records) => {
    confirmedRecords = records;
    renderQueue();
    renderNewSupplierPayeeList();
    if (confirmedRecords.length) {
      setStatus(
        `${confirmedRecords.length} confirmed payment${confirmedRecords.length === 1 ? "" : "s"} restored from the server queue.`,
        "muted"
      );
    }
  })
  .catch(() => {
    renderQueue();
    renderNewSupplierPayeeList();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    attachSessionNewSupplierFlags,
    buildNewSupplierPayeeExportFileName,
    buildNewSupplierPayeeExportText,
    buildNewSupplierPayeeGroups,
    getExtractionSourceLabel,
    mergeSelectedFiles,
    getSelectedFilesSummary,
    getUnsupportedFileMessage,
    getUploadLimitMessage,
    isSupportedUploadFile,
    formatExtractionTime,
    applySupplierDefaults,
    getSupplierResolutionUiState,
    getSupplierReviewMissingFields,
    normalizeCurrencyInput,
    normalizeSupplierLookupKey,
    shouldShowSupplierReview,
    updateSupplierReviewRequirement,
    loadSupplierMasterSummary,
    extractDownloadFileName,
    getResponseErrorMessage,
    triggerBrowserDownload,
    setSupplierMasterStatus,
  };
}
