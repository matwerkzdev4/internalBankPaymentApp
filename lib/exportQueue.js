const { buildBankFileFromRecords } = require("./bankFile");
const { buildPaymentRecord, validatePaymentRecord } = require("./paymentRecord");

function formatExportDatePart(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function formatExportTimePart(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}${minutes}`;
}

function buildConfirmedPaymentExportFileName(currency = "", recordCount = 0, date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const safeCount = String(Math.max(0, Number.parseInt(recordCount, 10) || 0)).padStart(3, "0");
  return `Ocbc_${year}${month}${day}${safeCount}.txt`;
}

function exportQueuedPayments(records = [], options = {}) {
  if (!Array.isArray(records) || !records.length) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Add at least one confirmed payment before export.",
      },
    };
  }

  const paymentRecords = records.map((record) => buildPaymentRecord(record || {}));
  const normalizedCurrency = paymentRecords[0]?.merged?.currency || "SGD";
  const invalidRecord = paymentRecords
    .map((paymentRecord, index) => ({
      index,
      validation: validatePaymentRecord(paymentRecord),
    }))
    .find((entry) => !entry.validation.isValid);

  if (invalidRecord) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Complete the required payment details for every confirmed payment before export.",
        invalidRecordIndex: invalidRecord.index,
        validation: invalidRecord.validation,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    fileName: buildConfirmedPaymentExportFileName(
      options.currency || normalizedCurrency,
      paymentRecords.length,
      options.now || new Date()
    ),
    fileContent: buildBankFileFromRecords(paymentRecords, {
      currency: options.currency || normalizedCurrency,
    }),
  };
}

module.exports = {
  buildConfirmedPaymentExportFileName,
  exportQueuedPayments,
  formatExportDatePart,
  formatExportTimePart,
};
