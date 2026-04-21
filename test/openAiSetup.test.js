const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getApiSetupState,
  saveOpenAiApiKey,
  validateApiKeyInput,
} = require("../lib/openAiSetup");

test("getApiSetupState reports setup required when OpenAI is unavailable", () => {
  const state = getApiSetupState({ openAiAvailable: false });
  assert.equal(state.openAiAvailable, false);
  assert.equal(state.setupRequired, true);
});

test("getApiSetupState reports complete when OpenAI is available", () => {
  const state = getApiSetupState({ openAiAvailable: true });
  assert.equal(state.openAiAvailable, true);
  assert.equal(state.setupRequired, false);
});

test("validateApiKeyInput rejects blank values", () => {
  assert.throws(() => validateApiKeyInput("   "), /Enter an OpenAI API key/i);
});

test("saveOpenAiApiKey uses the provided environment variable setter", async () => {
  let savedValue = null;
  const result = await saveOpenAiApiKey("sk-test-123", {
    platform: "win32",
    async setEnvironmentVariable(value) {
      savedValue = value;
    },
  });

  assert.equal(savedValue, "sk-test-123");
  assert.equal(result.saved, true);
  assert.equal(result.restartRequired, true);
});
