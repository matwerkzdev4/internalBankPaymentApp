# Bank Payment Tool Operator SOP

## When to use this tool

Use this tool when a finance operator needs to prepare a bank payment text file from an invoice and its supporting payment documents.

Do not use this tool as an approval workflow.
It is a preparation tool for checking details, building the payment list, and exporting the bank file.

## What to upload

Upload files for one payment only.

Good examples:
- invoice PDF
- supplier bank details letter or screenshot
- supporting DOCX or image file that clearly shows beneficiary details

Avoid:
- mixed files from different suppliers
- large unrelated batches
- unclear screenshots when a clearer source file exists

## Screen flow

### Step 1: Upload Documents

- Choose up to 5 files for one payment.
- Click `Read payment details`.
- Check that the selected files list shows the documents you expect.

Example screen state:

```text
Step 1 ready: 2 files selected
invoice.pdf
bank-details.png
```

### Step 2: Check Payment Details

- Review the fields the app filled in.
- Fix anything highlighted in red.
- Check the `Before You Confirm` summary card before moving on.
- If the supplier is new, save the supplier to this device first.

Double-check these items:
- supplier name
- invoice number
- amount and currency
- beneficiary name
- beneficiary bank code / SWIFT
- beneficiary account number
- remark

Example screen state:

```text
Step 2 ready. A saved supplier was found and used for any missing bank details.
Ready for step 3. Review the summary below, then confirm the payment into the list.
```

### Step 3: Confirmed Payment List

- Click `Confirm payment into list` only after the current payment looks correct.
- Review the correct currency queue.
- Export only the queue you want to process.

Example screen state:

```text
Step 3 ready: 3 confirmed payments across 2 currency queues
USD export queue
2 confirmed payments ready to export
```

### Step 4: New Supplier / Payee Setup List

- If new suppliers were created in this session, export the payee list too.
- Use that file to create payees in the bank application before payment processing if required.

Example screen state:

```text
Step 4 attention: 1 new supplier/payee item across 1 currency queue
USD payee setup queue
1 new supplier/payee item to set up in the bank application
```

## When to create a new supplier

Create and save a new supplier when:
- the supplier was not found in the saved list
- the supplier name is correct and clear
- the beneficiary bank code / SWIFT is available
- the beneficiary account number is available

Do not save a supplier if the bank details are incomplete or uncertain.

## What to do if extraction is incomplete

- Read the instructions shown in step 2.
- Fill the missing fields manually from the source documents.
- If bank details are not clearly shown, stop and get a better source document.
- Do not guess bank code, account number, or currency.

## Support owner

Assign one business owner for first-line support.
That person should collect operator questions, note where people hesitate, and decide whether wording or training needs to be updated.
