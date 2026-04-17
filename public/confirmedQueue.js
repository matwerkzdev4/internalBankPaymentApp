(function (globalScope) {
  function normalizeQueueText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function normalizeQueueAmount(value) {
    const trimmed = String(value ?? "").replace(/,/g, "").trim();
    if (!trimmed) {
      return "";
    }

    const numericValue = Number(trimmed);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : "";
  }

  function normalizeCurrency(value) {
    const normalized = normalizeQueueText(value);
    if (!normalized) {
      return "SGD";
    }

    return normalized === "CNY" ? "RMB" : normalized;
  }

  function buildQueueDuplicateKey(record = {}) {
    return [
      normalizeQueueText(record.supplierName),
      normalizeQueueText(record.invoiceNumber),
      normalizeQueueAmount(record.amount),
    ].join("::");
  }

  function findQueuedDuplicate(record = {}, confirmedRecords = []) {
    const recordKey = buildQueueDuplicateKey(record);
    if (!recordKey.replace(/:/g, "")) {
      return null;
    }

    return (
      confirmedRecords.find((queuedRecord) => buildQueueDuplicateKey(queuedRecord) === recordKey) || null
    );
  }

function groupRecordsByCurrency(records = []) {
  const grouped = new Map();

  records.forEach((record, index) => {
    const currency = normalizeCurrency(record.currency);
    if (!grouped.has(currency)) {
      grouped.set(currency, []);
    }
    grouped.get(currency).push({
      ...record,
      currency,
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

  const api = {
    buildQueueDuplicateKey,
    findQueuedDuplicate,
    groupRecordsByCurrency,
    normalizeCurrency,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ConfirmedQueue = api;
})(typeof window !== "undefined" ? window : globalThis);
