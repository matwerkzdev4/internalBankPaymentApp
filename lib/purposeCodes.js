const fs = require("fs");
const path = require("path");

const fallbackPurposeCodes = [
  { purpose_code: "IVPT", description: "Invoice Payment" },
  { purpose_code: "OTHR", description: "Other" },
  { purpose_code: "SALA", description: "Salary Payment" },
  { purpose_code: "SUPP", description: "Supplier Payment" },
  { purpose_code: "TAXS", description: "Tax Payment" },
];

function readPurposeCodes() {
  const filePath = path.join(__dirname, "..", "sg_giro_purpose_codes.md");

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const jsonText = content.match(/```json\s*([\s\S]*?)```/i)?.[1];
    const parsed = JSON.parse(jsonText);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry) => entry?.purpose_code && entry?.description)
        .map((entry) => ({
          purpose_code: String(entry.purpose_code).trim().toUpperCase(),
          description: String(entry.description).trim(),
        }));
    }
  } catch (error) {
    return fallbackPurposeCodes;
  }

  return fallbackPurposeCodes;
}

const purposeCodes = readPurposeCodes();
const purposeCodeMap = new Map(purposeCodes.map((entry) => [entry.purpose_code, entry.description]));

function normalizePurposeCode(value = "") {
  const normalized = String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return purposeCodeMap.has(normalized) ? normalized : "";
}

function getPurposeCodeDescription(value = "") {
  return purposeCodeMap.get(normalizePurposeCode(value)) || "";
}

function inferPurposeCode(text = "") {
  const explicit = String(text).match(/\b(?:purpose\s*code|payment\s*purpose)\s*[:\-]?\s*([A-Z0-9]{4})\b/i)?.[1];
  const explicitCode = normalizePurposeCode(explicit);
  if (explicitCode) {
    return explicitCode;
  }

  const lower = String(text).toLowerCase();
  if (/\bsalary\b|\bpayroll\b|\bwages?\b/.test(lower)) {
    return "SALA";
  }
  if (/\bgst\b|\btax\b/.test(lower)) {
    return lower.includes("gst") ? "GSTX" : "TAXS";
  }
  if (/\butilities?\b|\belectricity\b|\bwater\b|\bgas\b/.test(lower)) {
    return "UBIL";
  }
  if (/\bservices?\b|\bservice charge\b/.test(lower)) {
    return "SCVE";
  }
  if (/\bgoods?\b|\bmaterials?\b/.test(lower)) {
    return "GDDS";
  }
  if (/\binvoice\b/.test(lower)) {
    return "IVPT";
  }

  return "SUPP";
}

module.exports = {
  getPurposeCodeDescription,
  inferPurposeCode,
  normalizePurposeCode,
  purposeCodes,
};
