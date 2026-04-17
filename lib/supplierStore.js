const fs = require("node:fs");
const path = require("node:path");
const { normalizeText } = require("./paymentRecord");

const dataDir = path.join(__dirname, "..", "data");
const suppliersFilePath = path.join(dataDir, "suppliers.json");

function ensureSupplierStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(suppliersFilePath)) {
    fs.writeFileSync(suppliersFilePath, "[]\n", "utf8");
  }
}

function normalizeSupplierNameKey(value = "") {
  const normalized = normalizeText(value).toUpperCase();
  return normalized || "";
}

function buildSupplierRecord(input = {}, existingRecord = null) {
  const now = new Date().toISOString();
  const supplierName = normalizeText(input.supplierName);
  const normalizedSupplierKey = normalizeSupplierNameKey(supplierName);
  const bankSwiftCode = normalizeText(input.bankSwiftCode).toUpperCase();
  const beneficiaryAccountNumber = normalizeText(input.beneficiaryAccountNumber).replace(/\s+/g, "");

  if (!normalizedSupplierKey) {
    throw new Error("Supplier name is required to save a supplier master record.");
  }

  if (!bankSwiftCode || !beneficiaryAccountNumber) {
    throw new Error(
      "There are insufficient details to create this supplier profile. Add both the beneficiary bank identifier / SWIFT and beneficiary account number."
    );
  }

  return {
    supplierName,
    beneficiaryName: normalizeText(input.beneficiaryName),
    bankSwiftCode,
    beneficiaryAccountNumber,
    paymentReference: normalizeText(input.paymentReference),
    normalizedSupplierKey,
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
  };
}

function normalizeSupplierImportRecords(records = []) {
  if (!Array.isArray(records)) {
    throw new Error("Supplier import file must contain a JSON array of supplier records.");
  }

  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("Each supplier import row must be a JSON object.");
    }

    return buildSupplierRecord(record, record);
  });
}

function readSuppliers() {
  ensureSupplierStore();

  try {
    const raw = fs.readFileSync(suppliersFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeSuppliers(records = []) {
  ensureSupplierStore();
  fs.writeFileSync(suppliersFilePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return records;
}

function replaceSuppliers(records = []) {
  const normalizedRecords = normalizeSupplierImportRecords(records);
  return writeSuppliers(normalizedRecords);
}

function resolveSupplierMatch(input = {}) {
  const normalizedSupplierKey = normalizeSupplierNameKey(input.supplierName);
  if (!normalizedSupplierKey) {
    return {
      matchStatus: "cannot_match",
      matched: false,
      supplier: null,
      normalizedSupplierKey: null,
    };
  }

  const supplier = readSuppliers().find((record) => record.normalizedSupplierKey === normalizedSupplierKey) || null;

  return {
    matchStatus: supplier ? "matched" : "not_found",
    matched: Boolean(supplier),
    supplier,
    normalizedSupplierKey,
  };
}

function saveSupplier(input = {}) {
  const existingResolution = resolveSupplierMatch(input);
  const existingRecord = existingResolution.supplier;
  const nextRecord = buildSupplierRecord(input, existingRecord);
  const currentRecords = readSuppliers();

  const nextRecords = existingRecord
    ? currentRecords.map((record) =>
        record.normalizedSupplierKey === nextRecord.normalizedSupplierKey ? nextRecord : record
      )
    : [...currentRecords, nextRecord];

  writeSuppliers(nextRecords);
  return nextRecord;
}

module.exports = {
  buildSupplierRecord,
  normalizeSupplierNameKey,
  normalizeSupplierImportRecords,
  readSuppliers,
  replaceSuppliers,
  resolveSupplierMatch,
  saveSupplier,
  suppliersFilePath,
  writeSuppliers,
};
