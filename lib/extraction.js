const OpenAI = require("openai");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const {
  REQUIRED_EXPORT_FIELDS,
  buildPaymentRecord,
  normalizeAmount,
  normalizeText,
  validatePaymentRecord,
} = require("./paymentRecord");

const supportedTextExtensions = new Set([".txt", ".md"]);
const supportedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"]);
const supportedImageMimePrefixes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
]);
const supportedDocxExtensions = new Set([".docx"]);
const supportedDocxMimes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);
const supportedUploadExtensions = new Set([
  ".txt",
  ".md",
  ".pdf",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const buyerIndicators = ["bill to", "billed to", "customer", "sold to", "ship to", "attention"];
const supplierIndicators = ["supplier", "vendor", "from", "issued by", "seller", "payee", "remit to"];
const companyMarkers = [
  "pte ltd",
  "pte. ltd.",
  "private limited",
  "ltd",
  "limited",
  "llp",
  "llc",
  "inc",
  "inc.",
  "corp",
  "corporation",
  "co.",
  "company",
  "trading",
  "enterprise",
  "sdn bhd",
  "berhad",
];
const codIndicators = ["cod", "cash on delivery", "cash sale", "paid in cash", "cash payment"];
const ourCompanyNames = [
  "matwerkz technologies",
  "matwerkz technologie",
  "matwerkz technologies pte ltd",
  "matwerkz technologies pte. ltd.",
  "matwerkz technologies private limited",
];
const corporateSuffixReference = [
  "Ltd: Global UK",
  "Limited: Global UK",
  "Pte Ltd: APAC SG",
  "Pvt Ltd: APAC IN",
  "Pty Ltd: APAC AU",
  "Sdn Bhd: APAC MY",
  "Bhd: APAC MY",
  "Inc: NA US",
  "Incorporated: NA US",
  "Corp: NA US",
  "Corporation: NA US",
  "LLC: Global US",
  "LLP: Global UK",
  "Co Ltd: APAC HK",
  "Company Ltd: Global UK",
  "Co: Global",
  "GmbH: EMEA DE",
  "AG: EMEA DE",
  "SA: Global EU",
  "SAS: EMEA FR",
  "SARL: EMEA FR",
  "SRL: EMEA IT",
  "BV: EMEA NL",
  "NV: EMEA NL",
  "Ltda: LATAM BR",
  "SA de CV: LATAM MX",
];
const supportedCurrencyCodes = ["SGD", "RMB", "CNY", "USD", "GBP"];
const paymentRecordSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplierName: { type: "string" },
    invoiceNumber: { type: "string" },
    amount: { type: "string" },
    currency: { type: "string" },
    dueDate: { type: "string" },
    paymentReference: { type: "string" },
    bankSwiftCode: { type: "string" },
    beneficiaryAccountNumber: { type: "string" },
    beneficiaryName: { type: "string" },
    remark: { type: "string" },
  },
  required: [
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
  ],
};

async function extractTextFromFile(file) {
  const extension = getExtension(file.originalname);
  const mime = file.mimetype || "";

  if (mime === "application/pdf" || extension === ".pdf") {
    try {
      const parsed = await pdfParse(file.buffer);
      return parsed.text || "";
    } catch (error) {
      return "";
    }
  }

  if (mime.startsWith("text/") || supportedTextExtensions.has(extension)) {
    return file.buffer.toString("utf8");
  }

  if (supportedDocxExtensions.has(extension) || supportedDocxMimes.has(mime)) {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value || "";
    } catch (error) {
      return "";
    }
  }

  return "";
}

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function createOpenAiClient() {
  if (!hasOpenAiKey()) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getExtension(filename = "") {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

function isSupportedImageMime(mime = "") {
  const normalized = String(mime || "").toLowerCase();
  return supportedImageMimePrefixes.has(normalized);
}

function isSupportedUploadFile(file = {}) {
  const extension = getExtension(file.originalname || file.name || "");
  const mime = String(file.mimetype || file.type || "").toLowerCase();

  if (mime === "application/pdf" || extension === ".pdf") {
    return true;
  }

  if (mime.startsWith("text/") || supportedTextExtensions.has(extension)) {
    return true;
  }

  if (supportedDocxExtensions.has(extension) || supportedDocxMimes.has(mime)) {
    return true;
  }

  if (supportedImageExtensions.has(extension) || isSupportedImageMime(mime)) {
    return true;
  }

  return false;
}

function getInvalidUploadFiles(files = []) {
  return files.filter((file) => !isSupportedUploadFile(file));
}

function getSupportedUploadDescription() {
  return ".txt, .md, .pdf, .docx, and common image files such as .png, .jpg, .jpeg, .webp, .gif, .bmp, .tif, and .tiff";
}

function findFirstMatch(patterns, text) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeText(match[1]);
    }
  }
  return "";
}

function splitLines(text = "") {
  return text
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function getBottomHalfText(text = "") {
  const lines = splitLines(text);
  if (!lines.length) {
    return "";
  }

  return lines.slice(Math.floor(lines.length / 2)).join("\n");
}

function getTopHalfText(text = "") {
  const lines = splitLines(text);
  if (!lines.length) {
    return "";
  }

  return lines.slice(0, Math.ceil(lines.length / 2)).join("\n");
}

function getBankDetailText(text = "") {
  const lines = splitLines(text);
  const bankLines = lines.filter((line) =>
    /\bbank\b|\bswift\b|\biban\b|\baccount\b|\bbeneficiary\b|\bremit\b|\bpayee\b/i.test(line)
  );
  return bankLines.join("\n");
}

function normalizeCurrencyCode(value = "") {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) {
    return "";
  }

  return normalized === "CNY" ? "RMB" : normalized;
}

function hasCurrencyEvidence(value = "") {
  return supportedCurrencyCodes.includes(normalizeText(value).toUpperCase());
}

function documentHasCurrencyEvidence(text = "") {
  const currencyPattern = new RegExp(`\\b(${supportedCurrencyCodes.join("|")})\\b`, "i");
  return currencyPattern.test(text);
}

function findAmount(text) {
  const labeledPatterns = [
    /(?:total payable amount|payable amount|amount payable|amount due|grand total|total amount|invoice total|net amount|total)\s*[:\-]?\s*(?:SGD|RMB|CNY|USD|GBP)?\s*([\d,]+\.\d{2})/i,
    /(?:total payable amount|payable amount|amount payable|amount due|grand total|total amount|invoice total|net amount|total)\s*[:\-]?\s*([\d,]+\.\d{2})\s*(?:SGD|RMB|CNY|USD|GBP)?/i,
  ];
  const genericPatterns = [
    /(?:SGD|RMB|CNY|USD|GBP)\s*([\d,]+\.\d{2})/i,
  ];
  const searchAreas = [getBottomHalfText(text), text];

  for (const area of searchAreas) {
    for (const pattern of labeledPatterns) {
      const match = area.match(pattern);
      if (match?.[1]) {
        return normalizeAmount(match[1]);
      }
    }
  }

  for (const pattern of genericPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeAmount(match[1]);
    }
  }

  return "";
}

function findCurrency(text) {
  const currencyPattern = new RegExp(`\\b(${supportedCurrencyCodes.join("|")})\\b`, "i");
  const searchAreas = [getTopHalfText(text), getBankDetailText(text), text];

  for (const area of searchAreas) {
    const match = area.match(currencyPattern);
    if (match?.[1]) {
      return normalizeCurrencyCode(match[1]);
    }
  }

  return "SGD";
}

function inferSupplierName(cleaned) {
  const lines = cleaned
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const topLines = lines.slice(0, 12);
  const supplierLabeled = findFirstMatch(
    [
      /^(?:supplier|vendor|from|issued by|seller|remit to)\s*[:\-]\s*([^\n]+)/im,
    ],
    cleaned
  );

  if (isValidSupplierName(supplierLabeled)) {
    return cleanCandidateName(supplierLabeled);
  }

  const topCompanyCandidate = topLines.find((line) => isStrongCompanyCandidate(line) && !isBuyerSideLine(line));
  if (isValidSupplierName(topCompanyCandidate)) {
    return cleanCandidateName(topCompanyCandidate);
  }

  const generalCandidate = lines.find((line) => isStrongCompanyCandidate(line));
  if (isValidSupplierName(generalCandidate)) {
    return cleanCandidateName(generalCandidate);
  }

  return "";
}

function cleanCandidateName(value = "") {
  return normalizeText(value).replace(/^(?:supplier|vendor|from|issued by|seller|remit to)\s*[:\-]\s*/i, "");
}

function isBuyerSideLine(line = "") {
  const lower = line.toLowerCase();
  return buyerIndicators.some((indicator) => lower.includes(indicator));
}

function isSupplierSideLine(line = "") {
  const lower = line.toLowerCase();
  return supplierIndicators.some((indicator) => lower.includes(indicator));
}

function isOurCompany(line = "") {
  const lower = line.toLowerCase();
  return ourCompanyNames.some((name) => lower.includes(name));
}

function looksLikePersonName(line = "") {
  const normalized = normalizeText(line);
  if (!normalized) {
    return false;
  }

  const words = normalized.split(" ");
  const titleLike = /^(mr|mrs|ms|dr|mdm|mdm\.|prof)\b/i.test(normalized);
  const allWordsCapitalized = words.every((word) => /^[A-Z][a-z]+$/.test(word) || /^[A-Z]+$/.test(word));
  const hasCompanyMarker = companyMarkers.some((marker) => normalized.toLowerCase().includes(marker));

  return (titleLike || (words.length >= 2 && words.length <= 4 && allWordsCapitalized)) && !hasCompanyMarker;
}

function isStrongCompanyCandidate(line = "") {
  const normalized = normalizeText(line);
  const lower = normalized.toLowerCase();

  if (!normalized || isOurCompany(normalized) || isBuyerSideLine(normalized) || looksLikePersonName(normalized)) {
    return false;
  }

  if (/\d/.test(normalized) || /\bstreet\b|\broad\b|\bave\b|\bavenue\b|\bbuilding\b|\blevel\b|\bunit\b/i.test(normalized)) {
    return false;
  }

  if (companyMarkers.some((marker) => lower.includes(marker))) {
    return true;
  }

  return isSupplierSideLine(normalized);
}

function isValidSupplierName(value = "") {
  const normalized = cleanCandidateName(value);
  return Boolean(normalized) && !isOurCompany(normalized) && !looksLikePersonName(normalized);
}

function looksLikeCodInvoice(cleaned) {
  const lower = cleaned.toLowerCase();
  return codIndicators.some((indicator) => lower.includes(indicator));
}

function extractPaymentDetails(text) {
  const cleaned = text.replace(/\r/g, "");
  const codInvoice = looksLikeCodInvoice(cleaned);

  const supplierName =
    inferSupplierName(cleaned) || findLikelyName(cleaned);

  const invoiceNumber = findFirstMatch(
    [
      /invoice\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
      /inv\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    ],
    cleaned
  );

  const currency = findCurrency(cleaned);
  const amount = findAmount(cleaned);
  const dueDate = findFirstMatch(
    [
      /(?:due date|payment date)\s*[:\-]?\s*([^\n]+)/i,
      /(?:invoice date)\s*[:\-]?\s*([^\n]+)/i,
    ],
    cleaned
  );
  const paymentReference = findFirstMatch(
    [/^(?:payment reference|reference|description|remarks?)\s*[:\-]?\s*([^\n]+)/im],
    cleaned
  );

  const swiftMatches = codInvoice ? [] : cleaned.match(/\b[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g) || [];
  const bankSwiftCode = normalizeText(swiftMatches[0] || "").toUpperCase();
  const beneficiaryAccountNumber = codInvoice
    ? ""
    : findFirstMatch(
        [
          /(?:account(?: number| no\.?)?|a\/c(?: no\.?)?)\s*[:\-]?\s*([A-Z0-9\- ]{6,})/i,
          /beneficiary account\s*[:\-]?\s*([A-Z0-9\- ]{6,})/i,
        ],
        cleaned
      ).replace(/\s+/g, "");

  const beneficiaryName =
    findFirstMatch(
      [/^(?:beneficiary name|account name|payee|recipient)\s*[:\-]?\s*([^\n]+)/im],
      cleaned
    ) || supplierName;

  return {
    supplierName,
    invoiceNumber,
    amount,
    currency,
    dueDate,
    paymentReference,
    bankSwiftCode,
    beneficiaryAccountNumber,
    beneficiaryName,
    remark: invoiceNumber,
  };
}

function pickMissingFields(paymentRecord) {
  return validatePaymentRecord(paymentRecord).missingFields;
}

function mergeFieldSets(primary = {}, secondary = {}) {
  const merged = { ...primary };

  for (const [key, value] of Object.entries(secondary)) {
    if (!normalizeText(primary[key]) && normalizeText(value)) {
      merged[key] = value;
    }
  }

  return merged;
}

function buildOpenAiPrompt(localExtracted, missingFields) {
  const missingSummary = missingFields.length
    ? `Focus especially on these missing fields: ${missingFields.join(", ")}.`
    : "Return the full payment record.";
  const suffixBlock = `Corporate suffix reference:\n${corporateSuffixReference.join("\n")}`;

  return [
    "Extract one payment record. Return schema-valid JSON only.",
    "Use empty strings for unknown values. Do not invent unsupported values.",
    "Prefer the issuing supplier company for supplierName.",
    "Treat Matwerkz Technologies, Matwerkz Technologies Pte Ltd, Matwerkz Technologies Pte. Ltd., and close variants as buyer-side names, not supplierName, unless the document clearly shows Matwerkz is the issuing vendor.",
    "Do not use a person name for supplierName unless the document clearly shows a personal payee or sole proprietor.",
    "If the supplier is not obvious at the top, search the document for a company name with a legal designator and prefer that over buyer-side or person names.",
    suffixBlock,
    "Buyer-side labels: Bill To, Billed To, Customer, Sold To, Ship To, Attention.",
    "Supplier-side labels: Supplier, Vendor, From, Issued By, Seller, Payee, Remit To.",
    "If supplierName is unclear, return an empty string.",
    "For amount, prefer payable total labels such as Total, Total amount, Total payable amount, Payable amount, Amount payable, Amount due, Grand total, Invoice total, and Net amount.",
    "For amount, look especially near the bottom half of the document before using weaker amount-like numbers elsewhere.",
    "For currency, look for codes SGD, RMB, CNY, USD, and GBP.",
    "For currency, prefer the top-half breakdown table or header row first, then bank details if present.",
    "Normalize CNY to RMB in the returned JSON.",
    "For COD, cash on delivery, cash sale, or cash-based invoices, leave bankSwiftCode and beneficiaryAccountNumber blank unless clearly shown.",
    "remark should default to invoiceNumber when available.",
    `Current parser result: ${JSON.stringify(localExtracted)}`,
    missingSummary,
  ].join("\n");
}

function buildOpenAiInput(files, combinedText, localExtracted, missingFields) {
  const input = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: "You extract invoice and payment data for an internal bank payment tool.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: buildOpenAiPrompt(localExtracted, missingFields),
        },
      ],
    },
  ];

  const userContent = input[1].content;

  if (combinedText.trim()) {
    userContent.push({
      type: "input_text",
      text: `Parser text extracted from the uploaded files:\n${combinedText.slice(0, 30000)}`,
    });
  }

  for (const file of files) {
    const extension = getExtension(file.originalname);
    const mimeType = file.mimetype || "application/octet-stream";

    if (extension === ".pdf" || mimeType === "application/pdf") {
      userContent.push({
        type: "input_file",
        filename: file.originalname,
        file_data: `data:${mimeType};base64,${file.buffer.toString("base64")}`,
      });
      continue;
    }

    if (supportedImageExtensions.has(extension) || isSupportedImageMime(mimeType)) {
      userContent.push({
        type: "input_image",
        image_url: `data:${mimeType};base64,${file.buffer.toString("base64")}`,
      });
    }
  }

  return input;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

async function extractWithOpenAi(files, combinedText, localExtracted, missingFields) {
  const client = createOpenAiClient();
  if (!client) {
    return {
      skipped: true,
      reason: "missing_api_key",
      extracted: {},
    };
  }

  const response = await client.responses.create({
    model: openAiModel,
    input: buildOpenAiInput(files, combinedText, localExtracted, missingFields),
    text: {
      format: {
        type: "json_schema",
        name: "payment_record",
        schema: paymentRecordSchema,
        strict: true,
      },
    },
  });

  const outputText = response.output_text || "";
  const parsed = safeJsonParse(outputText);

  if (!parsed || typeof parsed !== "object") {
    return {
      skipped: false,
      reason: "invalid_json",
      extracted: {},
    };
  }

  const normalized = buildPaymentRecord({ extracted: parsed }).merged;

  return {
    skipped: false,
    reason: "used_openai",
    extracted: normalized,
  };
}

function findLikelyName(text) {
  const lines = text
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean);

  return (
    lines.find(
      (line) =>
        /^[A-Za-z0-9&.,'()\- ]{4,}$/.test(line) &&
        !/invoice|amount|date|account|bank|payment|tax/i.test(line) &&
        !isOurCompany(line) &&
        !looksLikePersonName(line)
    ) || ""
  );
}

async function extractFromDocuments(files = []) {
  const startedAt = Date.now();
  const documents = [];
  const combinedTextParts = [];

  for (const file of files) {
    const text = await extractTextFromFile(file);
    documents.push({
      fileName: file.originalname,
      mimeType: file.mimetype,
      extractedTextLength: text.length,
      usedForExtraction: Boolean(text),
      note: text ? "" : "No text could be extracted from this file. Manual entry may be required.",
    });

    if (text) {
      combinedTextParts.push(`FILE: ${file.originalname}\n${text}`);
    }
  }

  const combinedText = combinedTextParts.join("\n\n");
  const localTextFilesCount = documents.filter((doc) => doc.usedForExtraction).length;
  const filesWithoutLocalTextCount = documents.length - localTextFilesCount;
  const localExtracted = extractPaymentDetails(combinedText);
  const localPaymentRecord = buildPaymentRecord({ extracted: localExtracted });
  const missingFields = pickMissingFields(localPaymentRecord);
  const currencyExtracted = documentHasCurrencyEvidence(combinedText);

  let openAiResult = {
    skipped: true,
    reason: hasOpenAiKey() ? "not_needed" : "missing_api_key",
    extracted: {},
  };

  if (missingFields.length) {
    try {
      openAiResult = await extractWithOpenAi(files, combinedText, localExtracted, missingFields);
    } catch (error) {
      openAiResult = {
        skipped: false,
        reason: "openai_error",
        extracted: {},
      };
    }
  }

  const finalExtracted = mergeFieldSets(localExtracted, openAiResult.extracted);
  const paymentRecord = buildPaymentRecord({ extracted: finalExtracted });

  return {
    documents,
    paymentRecord,
    extractionMeta: {
      localParserUsed: true,
      openAiAttempted: missingFields.length > 0 && hasOpenAiKey(),
      openAiAvailable: hasOpenAiKey(),
      openAiReason: openAiResult.reason,
      currencyExtracted,
      localTextFilesCount,
      filesWithoutLocalTextCount,
      missingFieldsAfterLocalParser: missingFields,
      totalExtractionMs: Date.now() - startedAt,
      finalProvider:
        openAiResult.reason === "used_openai" ? "local_parser_plus_openai" : "local_parser_only",
    },
  };
}

module.exports = {
  extractFromDocuments,
  extractPaymentDetails,
  buildOpenAiPrompt,
  hasOpenAiKey,
  mergeFieldSets,
  normalizeCurrencyCode,
  pickMissingFields,
  getInvalidUploadFiles,
  getSupportedUploadDescription,
  isSupportedUploadFile,
  REQUIRED_EXPORT_FIELDS,
};
