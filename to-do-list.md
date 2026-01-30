
 ▐▛███▜▌   Claude Code v2.1.17
▝▜█████▛▘  Opus 4.5 · Claude Pro
  ▘▘ ▝▝    ~/Dev/lendflow

### TO DO LIST

- cost per ai processing is getting too expensive. suggested changes? 
Split the PDF: Don't send the whole document at once. Extract text from the PDF locally first, and send it in smaller, manageable chunks.
Use Embeddings/Search: Instead of passing the whole PDF as input to a prompt, use OpenAI’s File Search (formerly Assistants API) to search through documents. It is often more cost-effective for finding specific information.
Leverage Caching: If querying the same document multiple times, use input caching to reduce costs by 50% or more. 
=================================
- Debt Health Indicators, lets change "debt/adj. EBITDA" to "sr. debt/ adj. EBITDA"
- in the ratio breakdowns, add what all the items are that contribute to the overall calculation. Example: 
Stock-Based Compensation +$562K include an itemized list of every for the +$562K
=================================
- I'm going to add an image of a Bank employee's internal method, lets refine the logic because our ratios's are still off.
=================================
- we have been testing with zedcor inc's report, we are now going to test with the files in lendflow/public/financialReports. Review:
/Users/colinpoon/Dev/lendflow/public/financialReports/ADENAnRpt24 2.pdf
/Users/colinpoon/Dev/lendflow/public/financialReports/Taiga_-_December_31,_2024_audited_financial_statements.pdf
so that we can compare your findings to the apps.

Adjusted EBITDA
	•	$79.8M (from prior calc)

Fixed charges
	•	Lease interest expense: $5.17M
	•	Lease principal repayments: $6.43M
	•	Cash interest on debt: $0 (revolver unused)

Total fixed charges = 11.60M

FCCR
~6.9×
Senior Debt / Adj. EBITDA
0.0×
Total Debt / Total Cap
~18%

FCCR (no CapEx)
~6.9×
FCCR (after CapEx)
~6.5×

For your risk-scoring app, best practice is:
	•	Default to CapEx-adjusted FCCR
	•	Allow a toggle for:
	•	Maintenance CapEx
	•	Growth CapEx (if disclosed)
	•	Flag if CapEx > depreciation (not the case here)

- we will do the same with ADENA
=================================
- remove/ hide the next.js logo from all pages. 
- add an estimated time to complete an analysis while a a pdf is processing and add percentage completed to the progress bar. ❎


<!-- 
2022
Adjusted EBITDA 7,569k
Senior Debt Interest 976k
Sub Debt Interest 175k
Lease Payments 500k
Other Fixed Charges 0
Total Fixed Charges 1,651k
FCCR 4.59×
2023
Adjusted EBITDA 7,645k
Senior Debt Interest 1,949k
Sub Debt Interest 175k
Lease Payments 500k
Other Fixed Charges 0
Total Fixed Charges 2,624k
FCCR 2.91×

  Calculated FCCR
  \text{FCCR} = \frac{\text{Adjusted EBITDA}}{\text{Total Fixed Charges}}
      •    2022: 7.569 / 1.651 ≈ 4.59×
      •    2023: 7.645 / 2.624 ≈ 2.91×

Total Fixed Charges
\text{Total Fixed Charges} = \text{Senior Debt Interest} + \text{Sub Debt Interest} + \text{Lease Payments} + \text{Other Fixed Charges}
	•	2022: 0.976 + 0.175 + 0.5 + 0 ≈ 1.651M
	•	2023: 1.949 + 0.175 + 0.5 + 0 ≈ 2.624M -->


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



