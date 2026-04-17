# Demo Guide

Use this guide to show the current build honestly.

## Before the demo

Run:

```powershell
npm.cmd test
node .\scripts\generate-demo-report.js
```

Expected current result:
- automated tests pass
- upload gallery keeps visible file tiles for choose-files and drag-and-drop flows
- the text sample is ready for review and export
- `SFExpress.pdf` may still stay in manual-input flow if no trustworthy text or OpenAI vision result is available

## Demo flow

### Part 1: upload gallery proof

Use [demo/fixtures/happy-path-invoice.txt](C:\Users\user\OneDrive - MATWERKZ TECHNOLOGIES PTE. LTD\Documents\New project\bank-payment-app-simple\demo\fixtures\happy-path-invoice.txt) and one extra supported file.

Show:
- one chosen file appears in the upload gallery
- a second choose-files action adds to the same pending gallery instead of replacing it
- duplicate file picks are skipped with a clear status message
- drag-and-drop also shows file tiles in the same gallery area

### Part 2: happy-path extraction proof

Use [demo/fixtures/happy-path-invoice.txt](C:\Users\user\OneDrive - MATWERKZ TECHNOLOGIES PTE. LTD\Documents\New project\bank-payment-app-simple\demo\fixtures\happy-path-invoice.txt).

Show:
- upload succeeds
- invoice number, amount, beneficiary name, SWIFT, and account number are filled
- extraction evidence shows how many files had local text and how many needed vision-style fallback
- confirm adds the payment to the queue and the queue survives a page refresh
- export is allowed
- exported `.txt` file is created

### Part 3: real-world limitation proof

Use [SFExpress.pdf](C:\Users\user\OneDrive - MATWERKZ TECHNOLOGIES PTE. LTD\Documents\New project\bank-payment-app-simple\SFExpress.pdf).

Show:
- file upload succeeds
- the app accepts the document
- extraction evidence shows when no local text was found
- required export fields stay missing
- export remains blocked until manual values are entered

## What the audience should understand

- The current app is safe by default.
- It does not guess missing payment details from weak evidence.
- Manual correction is part of the intended current workflow.
- The server queue now survives refresh, but it is still a simple internal list, not an approval workflow.
- Dedicated OCR is still a known gap; today the app relies on local text parsing plus the existing OpenAI second pass when available.
