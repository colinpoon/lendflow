
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

credit-grade CapEx classifier built entirely around document terms, designed so your system can automatically determine:
	1.	Is it CapEx?
	2.	Maintenance vs Growth
	3.	Financed vs Unfinanced
	4.	Should it be deducted in FCCR?

	1. Classifier Output Schema (what your app should decide)
	{
  "is_capex": true,
  "capex_type": "maintenance | growth | mixed | unknown",
  "financing_type": "financed | unfinanced | revolver | unknown",
  "fccr_treatment": "deduct | do_not_deduct | partial_deduct | flag_review",
  "confidence": 0.0
}
 CapEx Detection Terms (Is it CapEx?)
 {
  "capex_detection_terms": [
    "capital expenditure",
    "capex",
    "property plant and equipment",
    "ppe",
    "fixed assets",
    "capitalized costs",
    "additions",
    "equipment purchases",
    "asset acquisition",
    "facility improvement",
    "leasehold improvement"
  ]
} If none of these appear → ❌ Not CapEx

Maintenance CapEx Classifier (deduct in FCCR)
These imply business continuity / replacement.
{
  "maintenance_capex_terms": [
    "replacement",
    "maintenance",
    "repair",
    "refurbishment",
    "upgrade existing",
    "sustaining",
    "safety requirement",
    "regulatory compliance",
    "environmental compliance",
    "it infrastructure upgrade",
    "software renewal",
    "system replacement",
    "fleet replacement",
    "routine capital spending"
  ]
}
✅ Strong signal → Maintenance CapEx

Growth / Expansion CapEx Classifier (usually NOT deducted)
These imply capacity increase or strategic expansion.
{
  "growth_capex_terms": [
    "expansion",
    "growth",
    "new facility",
    "new plant",
    "capacity increase",
    "new equipment",
    "greenfield",
    "brownfield expansion",
    "strategic investment",
    "new product line",
    "market expansion",
    "acquisition",
    "build-out"
  ]
}
⚠️ Strong signal → Growth CapEx

Financing Classifier (critical FCCR logic)
Financed CapEx (do NOT deduct)
{
  "financed_capex_terms": [
    "capital lease",
    "finance lease",
    "equipment financing",
    "equipment loan",
    "term loan",
    "vendor financing",
    "oem financing",
    "hire purchase",
    "debt financed",
    "lease obligation"
  ]
}
If matched →
👉 Do NOT deduct CapEx
👉 Include payments in FCCR denominator

Revolver-Funded CapEx (policy-dependent)
{
  "revolver_funded_terms": [
    "revolving credit facility",
    "revolver",
    "line of credit",
    "working capital facility",
    "drawn revolver"
  ]
}
⚠️ Usually treated as unfinanced
→ Often deduct, but flag for policy review

Unfinanced (Cash) CapEx (deduct if maintenance)
{
  "unfinanced_capex_terms": [
    "cash purchase",
    "paid in cash",
    "internally funded",
    "funded from operations",
    "no related financing",
    "cash outlay"
  ]
}
Strong signal → Unfinanced

FCCR Decision Logic (rules engine)
Deterministic Rules
IF maintenance_capex AND unfinanced
→ deduct

IF growth_capex
→ do_not_deduct

IF financed_capex
→ do_not_deduct

IF maintenance_capex AND revolver_funded
→ partial_deduct OR flag_review

IF mixed signals
→ flag_review

Why this works for underwriting
	•	Mirrors credit officer reasoning
	•	Avoids double counting
	•	Separates policy decisions from math
	•	Produces audit-defensible outputs
	•	Scales cleanly for AI + rules hybrid models