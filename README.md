
## Project Overview

Lendflow is a Next.js 15 application for bank loan risk analysis. It uses AI (OpenAI GPT-4 Turbo) to extract financial metrics from uploaded documents (PDF, Excel, Word) and performs credit risk assessment.

the purpose of this app is to leverage Ai and any other api's that you suggest in order to to compete with traditional financial institutions. 

Leveraging Ai to reduce the time it takes to review financial documents and collect accurate data in order to provide the information that allows individuals in key positions to determine the level of risk a company poses and wether or not a loan should or should not be approved. 

this app must be able to work with any company's financial report and deliver an accurate Adjusted Ebitda, senior debt/ebitda, total debt/ total capital, and FCCR.

Ai will review a financial document and return lending recommendations as well as Risk Analysis Report based on a similar rubric that a traditional financial institutions currently uses.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run build        # Production build (includes TypeScript & ESLint checks)
npm run lint         # Run ESLint
npm run start        # Start production server
```
Open [http://localhost:3000](http://localhost:3000) 

## Environment Variables

Requires `OPENAI_API_KEY` in `.env` file.

## Architecture
