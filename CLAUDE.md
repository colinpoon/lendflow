# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lendflow is a Next.js 15 application for bank loan risk analysis. It uses AI (OpenAI GPT-4 Turbo) to extract financial metrics from uploaded documents (PDF, Excel, Word) and performs credit risk assessment.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run build        # Production build (includes TypeScript & ESLint checks)
npm run lint         # Run ESLint
npm run start        # Start production server
```

## Environment Variables

Requires `OPENAI_API_KEY` in `.env` file.

## Architecture

### Key Feature 1

the purpose of this app is to leverage Ai and any other api's that you suggest in order to to compete with traditional financial institutions. 

### Key Feature 2

Leveraging Ai to reduce the time it takes to review financial documents and collect accurate data in order to provide the information that allows individuals in key positions to determine the level of risk a company poses and wether or not a loan should or should not be approved. 

### Key Feature 3

this app must be able to work with any company's financial report and deliver an accurate Adjusted Ebitda, senior debt/ebitda, total debt/ total capital, and FCCR.

### Key Feature 4

Ai will review a financial document and return lending recommendations as well as Risk Analysis Report based on a similar rubric that a traditional financial institutions currently uses.

### Data Flow
```
Document Upload → /api/extractData → aiProcessor.ts → OpenAI GPT-4 → Frontend Display
```

### Key Files

- `utils/aiProcessor.ts` - Core AI extraction logic. Chunks documents, sends to OpenAI with structured prompts, merges results, and computes financial ratios (DSCR, Senior Debt/EBITDA, Total Debt/Total Capital).

- `app/api/extractData/route.ts` - API endpoint handling file uploads via formidable. Disables body parsing (`bodyParser: false`) to handle multipart form data.

- `app/(dashboard)/(routes)/upload/page.tsx` - Main UI with four tabs: Upload, Extracted Data, Financial Analysis, Credit-Risk Snapshot.

### Display Components

- `FinancialTable.tsx` - Displays financial metrics by year with currency/ratio formatting
- `EBITDA.tsx` - Dedicated EBITDA display
- `RiskAssessment.tsx` - Credit risk analysis with 7 pillars (profitability, leverage, liquidity, debt service, interest rate sensitivity, concentration, governance)

### AI Extraction Schema

The AI extracts these metrics per fiscal year:
- revenue, net_income, expenses, profit_margins
- interest, taxes, depreciation_amortization, ebitda
- shareholders_equity, total_debt, senior_debt, debt_service_payments

Computed ratios:
- DSCR = EBITDA / debt_service_payments
- Senior Debt/EBITDA = senior_debt / EBITDA
- Total Debt/Total Capital = total_debt / (total_debt + shareholders_equity)

### UI Framework

Uses Shadcn/UI components in `components/ui/` with Tailwind CSS v4.

### Your Role

- Provide clear steps to achieve what is being asked of you
- Keep the Key Features in mind when asked to do something
- Provide clean readable code that a Senior Developer would approve of in a PR
- Suggest optimal options in order to achieve the best result for the Key Feautures
- Suggest alternatives to optimize the process
- don't only agree with me, challenge me if my prompt will negatively affect the overall accuracy and effeciency of the app.

### TO DO LIST

- continue to implement parallel processing
- Debt Health Indicators, lets change "debt/adj. EBITDA" to "sr. debt/ adj. EBITDA"
- in the ratio breakdowns, add what all the items are that contribute to the overall calculation. Example: 
Stock-Based Compensation +$562K what is everything included to get +$562K
- I'm going to add an image of a Bank employee's internal method, lets refine the logic because our ratios's are still off.
- we have been testing with zedcor inc's report, we are now going to test with Taiga. review this pdf, so we can compare your findings to the apps.
- we will do the same with ADENA

<!-- Reported EBITDA
18,121
Adjusted EBITDA
7,954

 let’s walk through why your reported EBITDA is $18,021 while mine was initially $18,121 and then revised to $18,121 again. That discrepancy of exactly 100 likely comes down to tax treatment or a rounding or label mismatch in the source.

Let’s break this down carefully:

⸻

🔍 Your Version (EBITDA = 18,021)

You likely used the standard formula:
\[
\text{EBITDA} = \text{Net Income} + \text{Interest} + \text{Depreciation & Amortization} + \text{Taxes}
\]

Your input values might be:
	•	Net income = 5,992
	•	Interest = 4,804
	•	Amortization = 7,211
	•	Tax expense = 14 ← (this is the likely difference)

Total:
5,992 + 4,804 + 7,211 + 14 = \boxed{18,021}

⸻

🧮 My Version (EBITDA = 18,121)

I used:
	•	Tax expense = 114 (from the OCR text):
“Current tax expense: 114”

So my total:
5,992 + 4,804 + 7,211 + 114 = \boxed{18,121}

⸻

✅ What’s the real number?

From the OCR extract:

Current tax expense 114 4,390

Looks like the 2024 tax is 114, not 14 — the OCR might blur small numbers, and if you read it as 14 instead of 114, that would cause the exact 100-point difference. -->


- remove/ hide the next.js logo from all pages. 
- add an estimated time to complete an analysis while a a pdf is processing and add percentage completed to the progress bar. ❎


