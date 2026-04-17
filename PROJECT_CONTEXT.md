# Project Context

## Product Summary

- This project is a browser-based internal bank payment tool.
- Staff upload invoices and supporting documents, review extracted payment details, correct them if needed, confirm each payment into a session queue, and export one fixed-width `.txt` bank payment file for the confirmed list.

## Current Implementation State

- Implemented now:
  - one-screen flow for upload, extract, review, confirm into list, and export confirmed list
  - fixed-width bank file export based on `Sample template.txt`
  - fixed payer header row from config and one dynamic transaction row per confirmed payment
  - local PDF and text parsing
  - server-only OpenAI second-pass extraction
  - manual correction before confirmation/export
  - validation that blocks confirmation or export when required fields are missing
- Implemented now:
  - multi-record export from a browser-session confirmed payment queue
  - confirmed payment queue grouped by currency with one export action per currency queue
  - queue-level duplicate checks based on normalized supplier name, invoice number, and amount
  - upload duplicate handling aligned to the live confirmed queue instead of stale file-memory state
  - dynamic header payment date on export in `DDMMYYYY`
  - alphanumeric-only bank-details output for transaction rows
  - structured OpenAI output using JSON schema
  - supplier-name guardrails in both prompt and local parser
  - COD guardrails that keep bank details blank unless clearly shown
  - stronger amount extraction for payable-total labels with bottom-half preference
  - stronger currency extraction for `SGD`, `RMB`, `CNY`, `USD`, and `GBP`
  - `CNY` normalized to `RMB` for queueing and downstream handling
- Implemented now:
  - simplified extraction evidence panel with OpenAI availability, provider used, currency extracted, missing required fields, and time taken
  - section 2 stays populated after confirm until the user clears it or runs the next extraction
  - inline red `Verify currency code` warning when currency was not truly extracted
  - standalone export section removed because export now lives in the confirmed payment list
  - hero heading updated to `Bank Payment Extraction Tool`
  - upload area updated for drag-and-drop, icon-based file tiles, `.docx` parsing, common image formats, and a 5-file cap
- Implemented now:
  - local project documentation files: `AGENTS.md`, `PROJECT_CONTEXT.md`, and `SESSION_LOG.md`
  - local `end-session` skill that updates `PROJECT_CONTEXT.md` and adds a new session log entry

## Agreed Product Direction

- Keep the product simple and internal-use focused.
- Do not turn it into an approval or audit workflow.
- One upload and review cycle creates one draft payment.
- Confirmed payments should be appended to a browser-session queue.
- Export should happen from the confirmed queue only.
- Keep the extraction order as:
  1. local parser
  2. OpenAI only if local extraction is incomplete
  3. manual user input if fields are still missing
- Keep OpenAI keys on the backend only.
- Do not expose secrets in browser code, HTML, local storage, or committed files.
- At the start of each session, open `PROJECT_CONTEXT.md` first, then review `SESSION_LOG.md`.

## Business Rules And Constraints

- `Matwerkz Technologies` should usually be treated as the buyer, not the supplier.
- Supplier name should usually come from the issuing company near the top of the invoice.
- Person names such as CEO or contact names should not be used as supplier names unless the document clearly indicates a personal payee.
- Prefer company-form names such as names containing `PTE LTD`, `LTD`, `LLP`, `INC`, `CORP`, `TRADING`, `ENTERPRISE`, or `SDN BHD`.
- For COD or cash-based invoices, do not guess SWIFT code or account number.
- Leave bank details blank unless clearly supported by the uploaded documents.
- The header payment date should reflect the current export date in `DDMMYYYY`.
- Transaction bank-details output should contain only letters and numbers.

## Known Gaps And Placeholders

- Real OCR for image-only scans is not implemented yet.
- No supplier master list is available yet.
- Confirmed payment queue state is browser-session only and clears on refresh or tab close.
- More real-document testing is still needed to refine extraction quality.
- OpenAI may still miss some currency values from real invoices, so more document testing is needed.
- Current demo issue: chosen or dropped files were not showing in the upload gallery, so live browser verification of multi-file UI state is still needed next session.

## Practical Testing Notes

- Automated tests currently cover:
  - bank file generation, including multi-record export
  - confirmed-queue duplicate matching and currency grouping
  - export queue validation
  - supplier-name guardrails
  - COD handling
  - amount-label and currency-code extraction heuristics
  - prompt guardrails
  - `SFExpress.pdf` current-state limitation
  - dynamic export date and bank-detail sanitization
  - extraction metadata for currency-found status and extraction timing
- Latest verified automated suite passed after the queue, extraction, upload-format, `.docx`, and multi-file helper updates.
- The unresolved upload-gallery problem appears to be in live browser behavior rather than the current automated helper coverage.
- Project context should be kept in `PROJECT_CONTEXT.md`.
- Session-by-session history should be kept in `SESSION_LOG.md`.
