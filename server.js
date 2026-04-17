const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  clearConfirmedQueue,
  readConfirmedQueue,
  writeConfirmedQueue,
} = require("./lib/confirmedQueueStore");
const {
  normalizeSupplierImportRecords,
  readSuppliers,
  replaceSuppliers,
  resolveSupplierMatch,
  saveSupplier,
} = require("./lib/supplierStore");
const {
  extractFromDocuments,
  getInvalidUploadFiles,
  getSupportedUploadDescription,
  hasOpenAiKey,
} = require("./lib/extraction");
const { bankConfig } = require("./lib/bankFile");
const { validatePaymentRecord } = require("./lib/paymentRecord");
const {
  exportQueuedPayments,
  formatExportDatePart,
  formatExportTimePart,
} = require("./lib/exportQueue");

function buildSupplierMasterExportFileName(records = [], date = new Date()) {
  const supplierCount = Math.max(0, Array.isArray(records) ? records.length : 0);
  return `supplier-master_${formatExportDatePart(date)}_${formatExportTimePart(date)}_${supplierCount}-suppliers.json`;
}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 20 * 1024 * 1024,
  },
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  res.json({
    headerPreview: bankConfig.header,
    requiredExportFields: [
      "bankSwiftCode",
      "beneficiaryAccountNumber",
      "beneficiaryName",
      "amount",
      "invoiceNumber",
    ],
    extractionProvider: {
      openAiAvailable: hasOpenAiKey(),
      statusMessage: hasOpenAiKey()
        ? "OpenAI second-pass extraction is available on the server."
        : "No OpenAI key configured on the server. The app will use local parsing, then manual input.",
    },
  });
});

app.get("/api/queue", (req, res) => {
  res.json({
    records: readConfirmedQueue(),
  });
});

app.post("/api/queue", (req, res) => {
  try {
    if (!Array.isArray(req.body?.records)) {
      return res.status(400).json({
        error: "Queue update failed. Send the confirmed payment list as records[].",
      });
    }

    const records = writeConfirmedQueue(req.body.records);
    res.json({ records });
  } catch (error) {
    res.status(500).json({
      error: "We could not save the confirmed payment queue.",
      details: error.message,
    });
  }
});

app.delete("/api/queue", (req, res) => {
  try {
    const records = clearConfirmedQueue();
    res.json({ records });
  } catch (error) {
    res.status(500).json({
      error: "We could not clear the confirmed payment queue.",
      details: error.message,
    });
  }
});

app.get("/api/suppliers", (req, res) => {
  try {
    res.json({
      records: readSuppliers(),
    });
  } catch (error) {
    res.status(500).json({
      error: "We could not load the supplier master list.",
      details: error.message,
    });
  }
});

app.get("/api/suppliers/export", (req, res) => {
  try {
    const records = readSuppliers();
    const fileName = buildSupplierMasterExportFileName(records);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(`${JSON.stringify(records, null, 2)}\n`);
  } catch (error) {
    res.status(500).json({
      error: "We could not export the supplier master list.",
      details: error.message,
    });
  }
});

app.post("/api/suppliers/resolve", (req, res) => {
  try {
    res.json(resolveSupplierMatch(req.body || {}));
  } catch (error) {
    res.status(500).json({
      error: "We could not resolve the supplier against the master list.",
      details: error.message,
    });
  }
});

app.post("/api/suppliers", (req, res) => {
  try {
    const savedSupplier = saveSupplier(req.body || {});
    res.json({ supplier: savedSupplier });
  } catch (error) {
    res.status(400).json({
      error: "We could not save this supplier profile.",
      details: error.message,
    });
  }
});

app.post("/api/suppliers/import", upload.single("supplierMasterFile"), (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        error: "Choose a supplier master JSON file to upload.",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(req.file.buffer.toString("utf8"));
    } catch (error) {
      return res.status(400).json({
        error: "Supplier master import failed. Upload a valid JSON file.",
      });
    }

    const records = replaceSuppliers(parsed);
    res.json({
      records,
      importedCount: records.length,
    });
  } catch (error) {
    res.status(400).json({
      error: "Supplier master import failed.",
      details: error.message,
    });
  }
});

app.post("/api/extract", upload.array("documents", 5), async (req, res) => {
  try {
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: "Upload at least one document to continue." });
    }

    const invalidFiles = getInvalidUploadFiles(files);
    if (invalidFiles.length) {
      return res.status(400).json({
        error: `Unsupported file type. Upload only ${getSupportedUploadDescription()}.`,
        invalidFiles: invalidFiles.map((file) => file.originalname),
      });
    }

    const result = await extractFromDocuments(files);
    const validation = validatePaymentRecord(result.paymentRecord);

    res.json({
      status: validation.isValid ? "ready_for_review" : "needs_input",
      ...result,
      validation,
    });
  } catch (error) {
    const isUploadLimitError = error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT";
    res.status(500).json({
      error: isUploadLimitError
        ? "Upload up to 5 documents at one time."
        : "We could not read the uploaded documents. Please try again or fill the payment details manually.",
      details: error.message,
    });
  }
});

app.post("/api/export", (req, res) => {
  try {
    const result = exportQueuedPayments(req.body?.records, {
      currency: req.body?.currency,
    });

    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    res.send(result.fileContent);
  } catch (error) {
    res.status(500).json({
      error: "We could not generate the bank payment file.",
      details: error.message,
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Bank payment tool listening on http://localhost:${port}`);
  });
}

module.exports = {
  buildSupplierMasterExportFileName,
};
