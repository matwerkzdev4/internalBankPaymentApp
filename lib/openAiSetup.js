const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { hasOpenAiKey } = require("./extraction");

const execFileAsync = promisify(execFile);

function getApiSetupState(options = {}) {
  const openAiAvailable = options.openAiAvailable ?? hasOpenAiKey();

  return {
    openAiAvailable,
    setupRequired: !openAiAvailable,
    statusMessage: openAiAvailable
      ? "OpenAI API setup is complete on this device."
      : "No OpenAI key is configured on this device yet. Add it once to enable AI backup extraction.",
  };
}

function validateApiKeyInput(apiKey = "") {
  const normalized = String(apiKey || "").trim();

  if (!normalized) {
    throw new Error("Enter an OpenAI API key before saving.");
  }

  return normalized;
}

async function saveOpenAiApiKey(apiKey, options = {}) {
  const normalizedKey = validateApiKeyInput(apiKey);
  const platform = options.platform || process.platform;

  if (platform !== "win32") {
    throw new Error("API key setup from inside the app is supported on Windows only.");
  }

  if (typeof options.setEnvironmentVariable === "function") {
    await options.setEnvironmentVariable(normalizedKey);
  } else {
    await execFileAsync("setx.exe", ["OPENAI_API_KEY", normalizedKey], {
      windowsHide: true,
    });
  }

  return {
    saved: true,
    restartRequired: true,
    message: "OpenAI API key saved for this Windows user. Restart the app once to enable AI backup extraction.",
  };
}

module.exports = {
  getApiSetupState,
  saveOpenAiApiKey,
  validateApiKeyInput,
};
