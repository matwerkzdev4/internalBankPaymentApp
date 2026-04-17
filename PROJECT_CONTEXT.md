# Project Context

## Product Summary

- This project is a browser-based internal bank payment tool.
- Staff upload invoices and supporting documents, review extracted payment details, correct them if needed, confirm each payment into a queue, and export one fixed-width `.txt` bank payment file for the confirmed list.

## Current Implementation State

- Implemented now:
  - one-screen flow for upload, extract, review, confirm into list, and export confirmed list
  - fixed-width bank file export based on `Sample template.txt`
  - fixed payer header row from config and one dynamic transaction row per confirmed payment
  - local PDF and text parsing
  - server-only OpenAI second-pass extraction
  - manual correction before confirmation/export
  - validation that blocks confirmation or export when required fields are missing
  - multi-record export from a browser-session confirmed payment queue
  - server-backed confirmed payment queue persistence across refresh
  - confirmed payment queue grouped by currency with one export action per currency queue
  - queue-level duplicate checks based on normalized supplier name, invoice number, and amount
  - dynamic header payment date on export in `DDMMYYYY`
  - alphanumeric-only bank-details output for transaction rows
  - structured OpenAI output using JSON schema
  - supplier-name guardrails in both prompt and local parser
  - COD guardrails that keep bank details blank unless clearly shown
  - stronger amount extraction for payable-total labels with bottom-half preference
  - stronger currency extraction for `SGD`, `RMB`, `CNY`, `USD`, and `GBP`
  - `CNY` normalized to `RMB` for queueing and downstream handling
  - simplified extraction evidence panel with OpenAI availability, provider used, currency extracted, missing required fields, and time taken
  - section 2 stays populated after confirm until the user clears it or runs the next extraction
  - inline red `Verify currency code` warning when currency was not truly extracted
  - standalone export section removed because export now lives in the confirmed payment list
  - hero heading updated to `Bank Payment Extraction Tool`
  - upload area uses the native file picker only, with a pre-extraction file queue capped at 5 files
  - selected upload files can be appended across multiple picker cycles, removed one by one, or cleared entirely before extraction
  - `.docx` parsing and common image-format support
  - persistent supplier master list stored locally on the backend in `data/suppliers.json`
  - supplier lookup after extraction with exact normalized supplier-name matching
  - supplier review step for new or unclear suppliers before payment confirmation
  - supplier profile creation blocked unless supplier name, beneficiary bank identifier / SWIFT, and beneficiary account number are present
  - supplier master import and export using local JSON files for device-to-device transfer
  - top-of-page supplier master card with import-first layout and supplier-only status messages
  - supplier export filename includes date, time, and supplier count
  - confirmed payment export filename uses `[CURRENCY CODE]_[DDMMYYYY]_[HHMM]_[count].txt`
  - confirmed payment export completion message shows the actual downloaded file name
  - session-based `New Supplier/Payee List` below the confirmed payment list
  - new supplier/payee items grouped by currency and deduplicated by supplier per currency
  - new supplier/payee `.txt` export by currency using `[CURRENCY CODE]_new-payees_[DDMMYYYY]_[HHMM]_[count].txt`
  - confirmed payment export reminder when that currency queue includes session-new payees
  - local project documentation files: `AGENTS.md`, `PROJECT_CONTEXT.md`, and `SESSION_LOG.md`
  - local `end-session` skill that updates `PROJECT_CONTEXT.md` and adds a new session log entry

## Agreed Product Direction

- Keep the product simple and internal-use focused.
- Do not turn it into an approval or audit workflow.
- One upload and review cycle creates one draft payment.
- Confirmed payments should be appended to a persistent confirmed-payment queue.
- Export should happen from the confirmed queue only.
- Supplier master should remain local to each device by default.
- A new device should start with an empty supplier master unless the user imports an existing supplier master JSON file.
- Newly created suppliers should also appear in a separate session-based payee-support list so users can set them up in the bank application.
- Keep the extraction order as:
  1. local parser
  2. OpenAI only if local extraction is incomplete
  3. manual user input if fields are still missing
- After extraction, check whether the supplier already exists in the supplier master list.
- If the supplier is new, show a supplier review step and save the confirmed supplier profile before continuing with the normal payment confirmation flow.
- Keep supplier import/export status inside the supplier master area, separate from the main workflow status.
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
- More real-document testing is still needed to refine extraction quality.
- OpenAI may still miss some currency values from real invoices, so more document testing is needed.

## Practical Testing Notes

- Automated tests currently cover:
  - bank file generation, including multi-record export
  - upload queue merge and duplicate-ignore helpers
  - confirmed-queue duplicate matching and currency grouping
  - confirmed-payment queue persistence
  - export queue validation
  - supplier-name guardrails
  - COD handling
  - amount-label and currency-code extraction heuristics
  - prompt guardrails
  - `SFExpress.pdf` current-state limitation
  - dynamic export date and bank-detail sanitization
  - extraction metadata for currency-found status and extraction timing
  - supplier master persistence, replacement import, and exact-name resolution
  - supplier master, confirmed payment, and new supplier/payee export filename helpers
  - session-based new supplier/payee grouping and export text helpers
- Latest verified automated suite passed with 72 tests after the supplier validation, session-based payee list, and payee export updates.
- Project context should be kept in `PROJECT_CONTEXT.md`.
- Session-by-session history should be kept in `SESSION_LOG.md`.
