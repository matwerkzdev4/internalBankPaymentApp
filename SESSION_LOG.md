# Session Log

## 2026-04-21

- Packaged the project as a Windows desktop app with Electron, including installer and portable build outputs.
- Moved persistent queue and supplier storage into writable per-device app-data paths and fixed the supplier-save blocker in the desktop app.
- Added a one-screen OpenAI API setup card in the top row, with backend setup through the current Windows user's `OPENAI_API_KEY` and a restart-required flow.
- Fixed the API key save bug by switching the Windows setup command to `setx.exe`.
- Verified the desktop app opened on another laptop and the latest automated suite passed with 85 tests.

## 2026-04-20

- Added guided-mode copy updates for finance operators, including a quick-start card, clearer section wording, and a visible extraction progress bar.
- Reworked section 2 messaging, removed the old `Before You Confirm` card, shortened queue remove buttons, and adjusted the currency field so lower-case typing is allowed before normalization.
- Made supplier review a dedicated frontend state driven by supplier master matching instead of loosely inferred UI state.
- Added supplier-check notice placement near the payment confirmation button and a clearer supplier confirmation button label.
- Added frontend test coverage for supplier-review requirement state and current UI text, and verified the automated suite passed with 76 tests.
- Live demo follow-up still found one unresolved issue: for some real invoices the supplier-check panel does not appear even though payment confirmation is blocked, so the next session should inspect the extraction output for the failing document and trace supplier resolution step by step.

## 2026-04-17

- Added stricter supplier-profile validation so new suppliers cannot be saved without supplier name, SWIFT, and account number.
- Added a session-based `New Supplier/Payee List` below the confirmed payment list, grouped by currency and deduplicated by supplier per currency.
- Added `.txt` export for the new supplier/payee list by currency and a confirmed-payment export reminder when session-new payees exist.
- Updated demo text and layout details, including header capitalization, queue wording, supplier review wording, and supplier summary copy.
- Verified the automated suite passed with 72 tests.

## 2026-04-17

- Implemented a local backend supplier master list with supplier review before payment confirmation.
- Added supplier master export/import so users can move the local supplier list between devices by JSON file replacement.
- Added supplier master filename metadata and confirmed payment filename metadata in the export flow.
- Moved the supplier master UI to the top of the page, reordered it to import first then export, and localized supplier import/export status messages inside that card.
- Hardened the confirmed payment export download path and verified the automated suite passed with 60 tests.

## 2026-04-17

- Simplified the upload UI to the native file picker only and removed drag-and-drop plus the old gallery-style preview path.
- Restored visible multi-file upload feedback with a simple selected-files list under the upload section.
- Extended the selected-files list into a pre-extraction upload queue that supports multiple picker cycles, duplicate-ignore behavior, per-file removal, and clear-all.
- Kept extraction evidence in the shorter 5-line demo-safe format.
- Added server-backed confirmed-payment queue persistence and matching test coverage.
- Agreed the next product direction should add a persistent supplier master list with a new-supplier review step before the usual payment confirmation flow.
- Verified the automated suite passed after the latest upload and queue changes.

## 2026-04-16

- Added upload-format validation, `.docx` parsing, common image-format support, and a 5-file upload cap.
- Added frontend helper coverage for pending multi-file merge, deduping, and status messaging.
- Verified the automated suite passed after the upload and extraction updates.
- Demo follow-up found a remaining live-browser bug: chosen or dropped files were still not appearing in the upload gallery area, so that issue needs to be debugged first next session.
- Changed upload duplicate handling to follow the live confirmed payment list instead of stale file-memory blocking.
- Added queue-level duplicate matching by normalized supplier name, invoice number, and amount.
- Split the confirmed payment list by currency and kept one export action per currency queue.
- Improved local amount extraction for payable-total labels and improved currency extraction for `SGD`, `RMB`, `CNY`, `USD`, and `GBP`.
- Normalized `CNY` to `RMB` for queue grouping and downstream handling.
- Simplified the extraction evidence panel to the demo-focused summary and added extraction timing plus true currency-found status.
- Removed the obsolete standalone export section and moved the row preview into section 2.
- Kept section 2 populated after confirm until the user clears it or triggers the next extraction.
- Added the inline red `Verify currency code` warning when currency was not truly extracted.
- Updated the hero heading to `Bank Payment Extraction Tool`.
- Verified the automated suite passed after the changes.

## 2026-04-15

- Expanded OpenAI supplier-name prompt guardrails for `Matwerkz Technologies` buyer-name variants.
- Added legal-designator guidance and a regional corporate suffix reference in the prompt.
- Added prompt-focused test coverage.
- Changed the workflow from single-record export to confirmed multi-payment queue export.
- Added a browser-session confirmed payment list with remove-before-export behavior.
- Updated backend export to validate and export multiple confirmed payments.
- Added multi-record bank-file tests and export-queue tests.
- Changed header export date to dynamic `DDMMYYYY`.
- Sanitized transaction bank-details export to alphanumeric only.
- Verified the full automated suite passed after the changes.

## 2026-04-15

- Created `AGENTS.md`, `PROJECT_CONTEXT.md`, and `SESSION_LOG.md` for local project guidance.
- Updated `AGENTS.md` to say `PROJECT_CONTEXT.md` must be opened first at the start of a session.
- Kept `SESSION_LOG.md` as a pure session-progress log instead of a summary file.
- Created `PROJECT_CONTEXT.md` in the format expected by the local `end-session` skill.
- Updated the local `end-session` skill so it now refreshes `PROJECT_CONTEXT.md` and also adds a new session log entry to `SESSION_LOG.md`.

## 2026-04-13 to 2026-04-15

- Reviewed the product direction and simplified it into a one-screen internal payment tool.
- Confirmed one upload session should create one payment record only.
- Confirmed the export should be a fixed-width `.txt` bank file based on `Sample template.txt`.
- Confirmed the first row is the fixed payer row and the second row is the dynamic payee row.
- Confirmed invoice number should be used as the default remark.
- Built the first working demo app in this project.
- Added upload, extraction, review, and export flow.
- Implemented fixed-width bank file generation.
- Added local parsing for PDF and text-based files.
- Confirmed OpenAI should be used instead of PaddleOCR for faster setup.
- Confirmed the extraction order should be:
  1. local parser
  2. OpenAI if local extraction is incomplete
  3. manual input if fields are still missing
- Confirmed OpenAI API keys must stay on the backend only.
- Implemented server-only OpenAI integration.
- Fixed the OpenAI parsing path by switching to structured JSON schema output.
- Verified OpenAI API access worked after the API key and credits were set up.
- Found supplier-name extraction issues from real testing.
- Confirmed `Matwerkz Technologies` should normally be treated as the buyer, not the supplier.
- Confirmed person names such as CEO or contact names should not be used as supplier names.
- Confirmed supplier name should usually come from the top issuer section of the invoice.
- Confirmed COD invoices should leave bank details blank unless clearly shown in uploaded documents.
- Added stronger prompt guardrails for supplier-name extraction.
- Added local parser guardrails for supplier-name and COD handling.
- Added tests for supplier-name and COD edge cases.
- Verified all current tests passed after the guardrail updates.
