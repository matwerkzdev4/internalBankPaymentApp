(function (globalScope) {
  function buildFileFingerprint(file = {}) {
    return [
      String(file.name || ""),
      String(file.size || 0),
      String(file.lastModified || 0),
      String(file.type || ""),
    ].join("::");
  }

  function findDuplicateUploads(files = [], seenFingerprints = new Set()) {
    const duplicates = [];

    for (const file of files) {
      const fingerprint = buildFileFingerprint(file);
      if (seenFingerprints.has(fingerprint)) {
        duplicates.push({
          fileName: file.name || "(unnamed file)",
          fingerprint,
        });
      }
    }

    return duplicates;
  }

  const api = {
    buildFileFingerprint,
    findDuplicateUploads,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DuplicateUploads = api;
})(typeof window !== "undefined" ? window : globalThis);
