# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lendflow is a Next.js 15 application for bank loan risk analysis. It uses AI (Anthropic Claude Sonnet 4) to extract financial metrics from uploaded documents (PDF, Excel, Word) and performs credit risk assessment.

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

## Environment Variables

Requires `ANTHROPIC_API_KEY` in `.env` file.

## Architecture


### Data Flow
```
Document Upload → /api/extractData → aiProcessor.ts → Claude Sonnet 4 → Frontend Display
```

### Key Files

- `utils/aiProcessor.ts` - Core AI extraction logic. Chunks documents, sends to Claude with structured prompts, merges results, and computes financial ratios (DSCR, Senior Debt/EBITDA, Total Debt/Total Capital).

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

---

### Workflow Orchestration

### 1. Plan Mode Default
	•	Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
	•	If something goes sideways, STOP and re-plan immediately — don’t keep pushing
	•	Use plan mode for verification steps, not just building
	•	Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
	•	Use subagents liberally to keep main context window clean
	•	Offload research, exploration, and parallel analysis to subagents
	•	For complex problems, throw more compute at it via subagents
	•	One task per subagent for focused execution

### 3. Self-Improvement Loop
	•	After ANY correction from the user: update tasks/lessons.md with the pattern
	•	Write rules for yourself that prevent the same mistake
	•	Ruthlessly iterate on these lessons until mistake rate drops
	•	Review lessons at session start for relevant project

### 4. Verification Before Done
	•	Never mark a task complete without proving it works
	•	Diff behavior between main and your changes when relevant
	•	Ask yourself: “would a staff engineer approve this?”
	•	Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
	•	For non-trivial changes: pause and ask “is there a more elegant way?”
	•	If a fix feels hacky: “Knowing everything I know now, implement the elegant solution”
	•	Skip this for simple, obvious fixes — don’t over-engineer
	•	Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
	•	When given a bug report: just fix it. Don’t ask for hand-holding
	•	Point at logs, errors, failing tests — then resolve them
	•	Zero context switching required from the user
	•	Go fix failing CI tests without being told how

### 7. Commit Discipline
	•	**Test before committing** — run `npm run build` (includes TypeScript + ESLint checks) before every commit. If it fails, fix it before committing.
	•	Commit after every completed subtask — never batch unrelated changes
	•	Write clear, concise commit messages that explain the **why**, not just the what
	•	Format: `type: short description` (e.g., `fix: correct FCCR denominator to include lease payments`)
	•	Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
	•	If a commit touches multiple areas, keep the message focused on the primary change
	•	Document what changed and why in the commit body when the diff isn’t self-explanatory

### 8. Rollback Awareness
	•	If a change breaks the build or introduces regressions, revert it immediately — don’t layer fixes on top of broken code
	•	Use `git diff` to review your own changes before committing — catch accidental deletions, debug logs, or unintended side effects

### 9. Context Preservation
	•	Never remove or overwrite existing code without understanding what it does first
	•	Read the file before editing — don’t assume structure based on file name alone
	•	When modifying shared utilities, check all call sites for downstream impact

### 10. Financial Accuracy Standards
	•	All financial calculations must match standard commercial banking methodology
	•	Never silently swallow missing data — log warnings when required inputs are absent and explain how the output is affected
	•	Sign conventions matter: expenses should be positive, gains should be clearly distinguished from operating income
	•	When in doubt, favor conservative (lender-protective) interpretations

### Task Management
	1.	Plan First: Write plan to tasks/todo.md with checkable items
	2.	Verify Plan: Check in before starting implementation
	3.	Track Progress: Mark items complete as you go
	4.	Explain Changes: High-level summary at each step
	5.	Document Results: Add review section to tasks/todo.md
	6.	Capture Lessons: Update tasks/lessons.md after corrections

###  Core Principles
	•	Simplicity First: Make every change as simple as possible. Impact minimal code.
	•	No Laziness: Find root causes. No temporary fixes. Senior developer standards.
	•	Minimal Impact: Changes should only touch what’s necessary. Avoid introducing bugs.

---