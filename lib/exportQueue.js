const { buildBankFileFromRecords } = require("./bankFile");
const { buildPaymentRecord, validatePaymentRecord } = require("./paymentRecord");

function exportQueuedPayments(records = []) {
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
    fileName: "bank-payments.txt",
    fileContent: buildBankFileFromRecords(paymentRecords),
  };
}

module.exports = {
  exportQueuedPayments,
};
