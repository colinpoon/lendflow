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

- `public/financialReports` - Test PDF's to ensure app's accuracy and integrity. 

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
