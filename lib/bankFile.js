const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "config", "bankFileConfig.json");
const bankConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

function blankLine(lineLength = bankConfig.layout.lineLength) {
  return " ".repeat(lineLength);
}

function writeField(line, start, length, value, alignment = "left", fill = " ") {
  const safeValue = String(value ?? "");
  const clipped = safeValue.slice(0, length);
  const padded =
    alignment === "right" ? clipped.padStart(length, fill) : clipped.padEnd(length, fill);

  return line.slice(0, start) + padded + line.slice(start + length);
}

function amountToMinorUnits(amount) {
  const cents = Math.round(Number(amount) * 100);
  return String(cents).padStart(bankConfig.layout.transaction.amountLength, "0");
}

function formatExportDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function sanitizeBankDetails(value = "") {
  return String(value).replace(/[^A-Za-z0-9]/g, "");
}

function createHeaderRow(overrides = {}) {
  const header = {
    ...bankConfig.header,
    scheduledPaymentDate: formatExportDate(),
    ...overrides,
  };
  const layout = bankConfig.layout.header;
  let line = blankLine();

  line = writeField(line, layout.recordTypeStart, layout.recordTypeLength, header.recordType);
  line = writeField(
    line,
    layout.payerBankAccountStart,
    layout.payerBankAccountLength,
    `${header.payerBankSwift}${header.payerAccountNumber}`
  );
  line = writeField(line, layout.payerNameStart, layout.payerNameLength, header.payerName);
  line = writeField(line, layout.paymentTypeStart, layout.paymentTypeLength, header.paymentType);
  line = writeField(
    line,
    layout.scheduledPaymentDateStart,
    layout.scheduledPaymentDateLength,
    header.scheduledPaymentDate
  );

  return line;
}

function createTransactionRow(paymentRecord) {
  const merged = paymentRecord.merged;
  const layout = bankConfig.layout.transaction;
  let line = blankLine();

  line = writeField(
    line,
    layout.bankAccountFieldStart,
    layout.bankAccountFieldLength,
    sanitizeBankDetails(`${merged.bankSwiftCode}${merged.beneficiaryAccountNumber}`)
  );
  line = writeField(
    line,
    layout.beneficiaryNameStart,
    layout.beneficiaryNameLength,
    merged.beneficiaryName
  );
  line = writeField(
    line,
    layout.amountStart,
    layout.amountLength,
    amountToMinorUnits(merged.amount),
    "right",
    "0"
  );
  line = writeField(
    line,
    layout.remarkStart,
    bankConfig.layout.lineLength - layout.remarkStart,
    merged.remark
  );

  return line;
}

function buildBankFile(paymentRecord, overrides = {}) {
  return buildBankFileFromRecords([paymentRecord], overrides);
}

function buildBankFileFromRecords(paymentRecords = [], overrides = {}) {
  const rows = [createHeaderRow(overrides), ...paymentRecords.map((paymentRecord) => createTransactionRow(paymentRecord))];
  return `${rows.join("\r\n")}\r\n`;
}

module.exports = {
  amountToMinorUnits,
  bankConfig,
  buildBankFile,
  buildBankFileFromRecords,
  createHeaderRow,
  createTransactionRow,
  formatExportDate,
  sanitizeBankDetails,
};
