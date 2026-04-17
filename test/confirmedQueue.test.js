const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildQueueDuplicateKey,
  findQueuedDuplicate,
  groupRecordsByCurrency,
  normalizeCurrency,
} = require("../public/confirmedQueue");

test("buildQueueDuplicateKey normalizes supplier, invoice number, and amount", () => {
  const key = buildQueueDuplicateKey({
    supplierName: " Bright Supplies Pte Ltd ",
    invoiceNumber: " inv-1001 ",
    amount: "1,250",
  });

  assert.equal(key, "BRIGHT SUPPLIES PTE LTD::INV-1001::1250.00");
});

test("findQueuedDuplicate matches queued records by supplier, invoice number, and amount", () => {
  const duplicate = findQueuedDuplicate(
    {
      supplierName: "bright supplies pte ltd",
      invoiceNumber: "INV-1001",
      amount: "1250.00",
    },
    [
      {
        supplierName: "Bright Supplies Pte Ltd",
        invoiceNumber: "INV-1001",
        amount: "1,250",
      },
    ]
  );

  assert.equal(duplicate?.invoiceNumber, "INV-1001");
});

test("findQueuedDuplicate does not match same invoice number when amount differs", () => {
  const duplicate = findQueuedDuplicate(
    {
      supplierName: "Bright Supplies Pte Ltd",
      invoiceNumber: "INV-1001",
      amount: "1250.00",
    },
    [
      {
        supplierName: "Bright Supplies Pte Ltd",
        invoiceNumber: "INV-1001",
        amount: "1250.50",
      },
    ]
  );

  assert.equal(duplicate, null);
});

test("normalizeCurrency defaults blanks to SGD", () => {
  assert.equal(normalizeCurrency(""), "SGD");
  assert.equal(normalizeCurrency(" usd "), "USD");
  assert.equal(normalizeCurrency("CNY"), "RMB");
});

test("groupRecordsByCurrency groups mixed-case currencies into sections", () => {
  const groups = groupRecordsByCurrency([
    { invoiceNumber: "INV-USD-1", currency: "usd" },
    { invoiceNumber: "INV-SGD-1", currency: "" },
    { invoiceNumber: "INV-USD-2", currency: "USD" },
    { invoiceNumber: "INV-RMB-1", currency: "rmb" },
    { invoiceNumber: "INV-CNY-1", currency: "CNY" },
  ]);

  assert.deepEqual(groups, [
    {
      currency: "RMB",
      items: [
        { invoiceNumber: "INV-RMB-1", currency: "RMB", sourceIndex: 3 },
        { invoiceNumber: "INV-CNY-1", currency: "RMB", sourceIndex: 4 },
      ],
    },
    {
      currency: "SGD",
      items: [{ invoiceNumber: "INV-SGD-1", currency: "SGD", sourceIndex: 1 }],
    },
    {
      currency: "USD",
      items: [
        { invoiceNumber: "INV-USD-1", currency: "USD", sourceIndex: 0 },
        { invoiceNumber: "INV-USD-2", currency: "USD", sourceIndex: 2 },
      ],
    },
  ]);
});
