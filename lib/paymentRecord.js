const REQUIRED_EXPORT_FIELDS = [
  "bankSwiftCode",
  "beneficiaryAccountNumber",
  "beneficiaryName",
  "amount",
  "invoiceNumber",
];

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const stringValue = String(value).replace(/,/g, "").trim();
  const numericValue = Number(stringValue);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "";
  }

  return numericValue.toFixed(2);
}

function normalizeCurrency(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) {
    return "SGD";
  }

  return normalized === "CNY" ? "RMB" : normalized;
}

function normalizeExportAlphanumeric(value) {
  return String(value ?? "").replace(/[^A-Za-z0-9]/g, "");
}

function buildPaymentRecord(input = {}) {
  const extracted = input.extracted ?? {};
  const corrected = input.corrected ?? {};
  const merged = {
    supplierName: normalizeText(corrected.supplierName || extracted.supplierName || input.supplierName),
    invoiceNumber: normalizeText(corrected.invoiceNumber || extracted.invoiceNumber || input.invoiceNumber),
    amount: normalizeAmount(corrected.amount || extracted.amount || input.amount),
    currency: normalizeCurrency(corrected.currency || extracted.currency || input.currency || "SGD"),
    dueDate: normalizeText(corrected.dueDate || extracted.dueDate || input.dueDate),
    paymentReference: normalizeText(
      corrected.paymentReference || extracted.paymentReference || input.paymentReference
    ),
    bankSwiftCode: normalizeText(
      corrected.bankSwiftCode || extracted.bankSwiftCode || input.bankSwiftCode
    ).toUpperCase(),
    beneficiaryAccountNumber: normalizeText(
      corrected.beneficiaryAccountNumber ||
        extracted.beneficiaryAccountNumber ||
        input.beneficiaryAccountNumber
    ).replace(/\s+/g, ""),
    beneficiaryName: normalizeText(
      corrected.beneficiaryName || extracted.beneficiaryName || input.beneficiaryName
    ),
    remark: normalizeExportAlphanumeric(
      normalizeText(corrected.remark || extracted.remark || input.remark)
    ),
  };

  if (!merged.beneficiaryName) {
    merged.beneficiaryName = merged.supplierName;
  }

  if (!merged.remark) {
    merged.remark = normalizeExportAlphanumeric(merged.invoiceNumber);
  }

  return {
    extracted,
    corrected,
    merged,
  };
}

function validatePaymentRecord(paymentRecord) {
  const merged = paymentRecord?.merged ?? {};
  const missingFields = REQUIRED_EXPORT_FIELDS.filter((field) => !normalizeText(merged[field]));

  if (merged.amount && !normalizeAmount(merged.amount)) {
    missingFields.push("amount");
  }

  return {
    isValid: missingFields.length === 0,
    missingFields: [...new Set(missingFields)],
  };
}

module.exports = {
  REQUIRED_EXPORT_FIELDS,
  buildPaymentRecord,
  normalizeAmount,
  normalizeCurrency,
  normalizeExportAlphanumeric,
  normalizeText,
  validatePaymentRecord,
};
