# Demo Guide

Use this guide to show the current build honestly and in the same order as the live screen.

## Before the demo

Run:

```powershell
npm.cmd test
node .\scripts\generate-demo-report.js
```

Expected current result:
- automated tests pass
- the app shows the guided finance-operator layout
- upload uses the native file picker only
- the selected-files queue appears under step 1 before reading starts
- the happy-path sample is ready for extraction, review, confirmation, and export
- `SFExpress.pdf` may still need manual completion because real OCR for image-only scans is not implemented yet

## Demo flow

### Part 1: guided upload flow

Use [happy-path-invoice.txt](C:\Users\user\OneDrive - MATWERKZ TECHNOLOGIES PTE. LTD\Documents\New project\bank-payment-app-simple\demo\fixtures\happy-path-invoice.txt) and one extra supported file.

Show:
- the page opens with the `Bank Payment Extraction Tool` heading and the quick-start finance-operator guide
- step 1 uses the native file picker, not drag-and-drop
- one chosen file appears in the selected-files list
- a second choose-files action adds to the same pending list instead of replacing it
- duplicate file picks are ignored with a clear status message
- files can be removed one by one or cleared before reading starts

### Part 2: happy-path extraction and confirmation

Use [happy-path-invoice.txt](C:\Users\user\OneDrive - MATWERKZ TECHNOLOGIES PTE. LTD\Documents\New project\bank-payment-app-simple\demo\fixtures\happy-path-invoice.txt).

Show:
- reading starts from step 1 and the extraction progress bar appears
- step 2 fills the payment form with the extracted values
- invoice number, amount, beneficiary name, beneficiary bank code / SWIFT, and beneficiary account number are filled
- the evidence panel stays in the short demo-safe format:
  - server AI backup available
  - source used
  - currency found in the documents
  - more operator input needed
  - reading time
- the bank row preview updates from the reviewed values
- if the supplier is already known, the app can use saved supplier details to fill missing bank fields
- confirmation adds the payment into the confirmed payment list under the correct currency queue
- export from that currency queue is available
- the exported `.txt` file is created with the current filename pattern

### Part 3: supplier review and payee setup proof

Use a document that produces a supplier not already saved in the local supplier list.

Show:
- the supplier check appears before payment confirmation when the supplier is new or unclear
- the payment cannot be confirmed until the supplier review is completed
- saving the supplier requires supplier name, beneficiary bank code / SWIFT, and beneficiary account number
- after the supplier is saved, payment confirmation is allowed
- the confirmed payment can also appear in the `New Supplier / Payee Setup List`
- the payee setup list is grouped by currency and can be exported as a separate `.txt` file for bank setup work

### Part 4: queue persistence and export proof

Show:
- confirmed payments stay in the server-backed queue after a page refresh
- the confirmed payment list is grouped by currency
- export happens from the confirmed payment list, not from a separate export section
- if that currency queue includes session-new payees, the export flow reminds the operator about the payee setup list
- the queue remains a simple internal working list, not an approval workflow

### Part 5: real-world limitation proof

Use [SFExpress.pdf](C:\Users\user\OneDrive - MATWERKZ TECHNOLOGIES PTE. LTD\Documents\New project\bank-payment-app-simple\SFExpress.pdf).

Show:
- file upload succeeds
- the app accepts the document and attempts extraction
- the evidence panel may still show that more operator input is needed
- required payment fields can remain missing when trustworthy text is not available
- the supplier-check flow may also be blocked if the supplier name is too unclear
- payment confirmation and export stay blocked until the operator fills the missing required values

## What the audience should understand

- The current app is safe by default.
- It does not guess missing bank details from weak evidence.
- Manual review and correction are part of the intended workflow.
- The supplier master is now part of the normal process, not an extra admin-only feature.
- New suppliers must be reviewed and saved before payment confirmation.
- The confirmed payment queue survives refresh and exports by currency.
- New supplier/payee setup can be exported separately for bank onboarding work.
- Dedicated OCR is still a known gap. Today the app relies on local text parsing plus the server-side OpenAI second pass when needed.
