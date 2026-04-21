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
const { getApiSetupState, saveOpenAiApiKey } = require("./lib/openAiSetup");

function buildSupplierMasterExportFileName(records = [], date = new Date()) {
  const supplierCount = Math.max(0, Array.isArray(records) ? records.length : 0);
  return `supplier-master_${formatExportDatePart(date)}_${formatExportTimePart(date)}_${supplierCount}-suppliers.json`;
}

function createApp() {
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
    const apiSetup = getApiSetupState();

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
        openAiAvailable: apiSetup.openAiAvailable,
        statusMessage: apiSetup.openAiAvailable
          ? "OpenAI second-pass extraction is available on the server."
          : "No OpenAI key configured on the server. The app will use local parsing, then manual input.",
      },
      apiSetup,
    });
  });

  app.post("/api/openai/setup", async (req, res) => {
    try {
      const result = await saveOpenAiApiKey(req.body?.apiKey || "");
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: "We could not save the OpenAI API key.",
        details: error.message,
      });
    }
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

  return app;
}

function startServer(options = {}) {
  const app = createApp();
  const host = options.host || process.env.HOST || "127.0.0.1";
  const normalizedPort = options.port ?? process.env.PORT ?? 3000;

  return new Promise((resolve, reject) => {
    const server = app.listen(normalizedPort, host, () => {
      const address = server.address();
      const resolvedPort = typeof address === "object" && address ? address.port : normalizedPort;
      resolve({
        app,
        host,
        port: resolvedPort,
        server,
        url: `http://${host}:${resolvedPort}`,
      });
    });

    server.on("error", reject);
  });
}

if (require.main === module) {
  startServer()
    .then(({ url }) => {
      console.log(`Bank payment tool listening on ${url}`);
    })
    .catch((error) => {
      console.error("Bank payment tool failed to start.", error);
      process.exitCode = 1;
    });
}

module.exports = {
  buildSupplierMasterExportFileName,
  createApp,
  startServer,
};
