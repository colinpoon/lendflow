# Codebase Concerns

**Analysis Date:** 2026-02-05

## Tech Debt

**No Persistent Database Implementation:**
- Issue: Supabase client is initialized (`utils/supabase/client.ts`, `utils/supabase/server.ts`, `utils/supabase/middleware.ts`) but never used. Project data is not persisted—projects exist only in memory with mock IDs.
- Files: `app/dashboard/new/page.tsx` (line 42-44), `utils/supabase/client.ts`, `utils/supabase/server.ts`
- Impact: Users cannot save projects, reload state, or revisit analyses. Entire workflow is ephemeral.
- Fix approach: Implement database schema for projects, extracted metrics, and assessments. Wire Supabase calls in project creation and upload handlers.

**Missing Test Coverage:**
- Issue: No test files present in codebase. 67 TypeScript/TSX files with zero automated tests. Complex financial calculation logic (`lib/calculations/ebitda-calculator.ts`, `lib/calculations/fccr-calculator.ts`) has no validation tests.
- Files: All `lib/calculations/*.ts` files, `utils/aiProcessor.ts`
- Impact: Calculation errors (e.g., adjusted EBITDA, FCCR formulas) cannot be caught. Refactoring is high-risk.
- Fix approach: Add Jest or Vitest. Minimum: unit tests for all ratio calculators with known reference values (Zedcor FY2024 included in comments as test fixture).

**Hardcoded Prompt Configuration:**
- Issue: Critical AI extraction prompts are embedded in `lib/prompts/extraction-prompt.ts` as static strings (344 lines). Changes require code redeployment.
- Files: `lib/prompts/extraction-prompt.ts` (FINANCIAL_EXTRACTION_PROMPT, RISK_ASSESSMENT_PROMPT, DEBT_HEALTH_PROMPT)
- Impact: Cannot A/B test prompts. Cannot adjust extraction rules without rebuild.
- Fix approach: Move prompts to environment variables or database config table. Support prompt versioning.

**Excessive Console Logging in Production:**
- Issue: 196+ console.log/console.error statements scattered throughout. Debug output pollutes logs with financial data snippets and calculation details.
- Files: `utils/aiProcessor.ts` (lines 306-378 debug blocks), `app/api/extractData/route.ts` (lines 19-131 extensive logging), `lib/chunk-processor.ts` (lines 67-181)
- Impact: Logs are hard to parse. Sensitive financial information may leak to log aggregation services.
- Fix approach: Implement structured logging with severity levels. Strip debug output in production builds.

**Orphaned Supabase Integration:**
- Issue: Supabase middleware exists but is never invoked. Environment variables likely not configured (no schema defined).
- Files: `utils/supabase/middleware.ts`, `utils/supabase/server.ts`, `utils/supabase/client.ts`
- Impact: Auth and session management not functional. Dead code that creates confusion.
- Fix approach: Either complete Supabase auth integration or remove these files entirely.

## Known Bugs

**File Not Cleaned Up After Processing:**
- Symptoms: Uploaded files remain in `/uploads` directory indefinitely, consuming disk space.
- Files: `app/api/extractData/route.ts` (lines 20-24)
- Trigger: Upload any file via `/api/extractData`
- Workaround: Manually delete `/uploads` directory or implement scheduled cleanup task.
- Fix approach: Add cleanup logic after successful extraction. Use temp directory or delete on response completion.

**Sequential Processing Creates Scaling Bottleneck:**
- Symptoms: Large documents (multiple chunks) process slowly. One chunk at a time means 30+ second processing for typical financial statements.
- Files: `lib/chunk-processor.ts` (lines 151-183, `processChunksSequentially`)
- Trigger: Upload document with >3 chunks (>60KB typical financial report)
- Cause: Intentionally sequential for determinism (per comments line 6-8). Fallback parallel batching is deprecated (line 192-242).
- Improvement path: Implement parallel-with-deterministic-merge strategy. Hash-based deduplication already ensures idempotency; ordering can be controlled at merge level.

**Type Safety Violations (any Types):**
- Symptoms: Silent failures when data structure changes. Type checker cannot catch mismatches.
- Files: `app/(dashboard)/(routes)/upload/page.tsx` (lines 53, 57, 73), `app/dashboard/[projectId]/page.tsx` (lines 70, 72, 79), `app/api/extractData/route.ts` (line 43, 59, 139)
- Cause: Heavy use of `any` for extracted AI responses and form data.
- Impact: AI response parsing errors go unnoticed until frontend renders fail.
- Fix approach: Create strict TypeScript interfaces for all API responses. Use Zod or similar validation.

**Unvalidated AI Extraction Output:**
- Symptoms: If GPT-4 returns malformed JSON or unexpected schema, code silently fails or returns null.
- Files: `lib/chunk-processor.ts` (lines 108-110), `lib/extraction-merger.ts`
- Trigger: Rate limit recovery, API errors, or model hallucination
- Cause: JSON parse wrapped in try/catch but no schema validation after parsing.
- Fix approach: Validate extracted JSON against expected schema before merging. Add specific error messages for schema violations.

## Security Considerations

**File Upload Path Traversal Risk:**
- Risk: formidable configured without strict validation. User-supplied filenames could potentially escape upload directory.
- Files: `app/api/extractData/route.ts` (lines 28-34)
- Current mitigation: File path is resolved and validated before processing (lines 104-117). filenames not exposed to filesystem operations.
- Recommendations: Add explicit filename validation (alphanumeric + safe chars only). Consider renaming uploaded files to UUIDs. Implement maximum filename length.

**Sensitive Data in Request Logs:**
- Risk: Financial metrics (revenue, debt figures, etc.) are logged to console and potentially to log aggregators. Violates data privacy.
- Files: `utils/aiProcessor.ts` (lines 306-378), `app/api/extractData/route.ts` (lines 130)
- Current mitigation: None. Data is raw in logs.
- Recommendations: Never log extracted metrics in production. Use structured logging with `[REDACTED]` placeholders. Exclude financial data from request/response logging.

**OpenAI API Key Exposure:**
- Risk: API key used directly in `lib/chunk-processor.ts` (line 16) from environment variable. If `.env` file is committed, key is exposed.
- Files: `lib/chunk-processor.ts` (line 16)
- Current mitigation: Requires `OPENAI_API_KEY` env var but no check for .env in git.
- Recommendations: Add `.env` to `.gitignore` (verify it exists). Implement secret rotation policy. Consider API key scoping/organization-level management.

**Missing CORS/CSRF Protection:**
- Risk: API endpoint at `app/api/extractData/route.ts` has no CORS headers or CSRF token validation.
- Files: `app/api/extractData/route.ts`
- Current mitigation: None explicitly visible.
- Recommendations: Add CORS origin validation. Implement CSRF token check. Use SameSite cookies for session.

**No Rate Limiting on Upload Endpoint:**
- Risk: Attackers could flood `/api/extractData` with large files, exhausting OpenAI quota and server storage.
- Files: `app/api/extractData/route.ts`
- Current mitigation: 20MB file size limit (line 31) and OpenAI rate limit handling (lib/chunk-processor.ts lines 122-132) but no request-level rate limiting.
- Recommendations: Implement rate limiting per IP/user. Add authentication requirement. Monitor OpenAI spend with cost alerts.

## Performance Bottlenecks

**Sequential AI Chunk Processing:**
- Problem: Each chunk processes one-at-a-time with 1500ms+ delay between (lib/chunk-processor.ts line 172). Large documents timeout or take 2+ minutes.
- Files: `lib/chunk-processor.ts` (lines 151-183, 172)
- Cause: Forced sequential ordering for merge determinism. Comment on line 6-8 states "SEQUENTIAL for determinism."
- Improvement path: Parallel API calls to OpenAI with deterministic merge (sort by chunk index). Results are already hash-keyed; ordering matters only at display level.

**No Pagination on Dashboard:**
- Problem: Projects list rendered without pagination. Not yet impactful (mock data only) but will be critical with database.
- Files: `app/dashboard/page.tsx` (lines 25-65)
- Cause: Projects array rendered directly. No lazy loading.
- Improvement path: Implement cursor-based pagination. Virtual scrolling for large lists.

**AI Response Logging Without Truncation:**
- Problem: Full AI responses logged to console (lib/chunk-processor.ts line 105). For large chunks, console output is massive.
- Files: `lib/chunk-processor.ts` (line 105)
- Impact: Browser dev tools freeze when opening console. Server logs balloon in size.
- Improvement path: Log only response status/size. Store full responses in debug-only mode or file.

**No Caching of Calculation Results:**
- Problem: Risk assessments and debt health scores recalculated on every page load. No memoization across component tree.
- Files: `app/(dashboard)/(routes)/upload/page.tsx` (lines 123-124), `utils/aiProcessor.ts` (lines 123-124)
- Impact: Slow re-renders if user toggles tabs.
- Improvement path: Implement React Query or SWR for caching extracted data. Cache risk assessments in state management.

## Fragile Areas

**Adjusted EBITDA Calculation Logic:**
- Files: `lib/calculations/ebitda-calculator.ts` (lines 64-185)
- Why fragile: Highly complex business logic with many conditional branches. Gains/losses normalization via Math.abs() (line 123) is fragile—negative values may indicate extraction errors.
- Safe modification: Test against Zedcor reference values (included in file comments). Verify each adjustment component independently. Document any formula changes with business rationale.
- Test coverage: None. No unit tests for adjustment combinations.

**Extraction Merger (First-Wins Strategy):**
- Files: `lib/extraction-merger.ts`
- Why fragile: Deterministic merge uses "first chunk wins" for conflicting values. If first chunk has incorrect extraction, error propagates to final result.
- Safe modification: Consider consensus-based merge (majority vote across chunks) for high-value fields. Add conflict detection and warnings.
- Test coverage: None. Complex merge logic untested.

**AI Prompt Engineering (Parentheses Convention):**
- Files: `lib/prompts/extraction-prompt.ts` (lines 151-155, 144-149)
- Why fragile: Relies on strict interpretation of financial statement parentheses convention (negative values). AI hallucination could invert signs.
- Safe modification: Add explicit examples to prompt. Validate extracted values against balance sheet constraints (e.g., debt cannot be negative). Cross-check gains/losses by line item.
- Test coverage: No tests for prompt accuracy against real documents.

**FCCR Calculation with Configurable CapEx Treatment:**
- Files: `lib/calculations/fccr-calculator.ts` (lines 47-71, 86-208)
- Why fragile: Four different CapEx treatment modes ('unfunded', 'all', 'none', 'custom'). UI never exposes this config—always uses default 'unfunded'. If mode changes, results silently differ.
- Safe modification: Make CapEx treatment selectable in UI. Log which mode was used. Test against financial covenants.
- Test coverage: No tests for different modes.

**Risk Assessment Scoring (Manual Thresholds):**
- Files: `lib/prompts/extraction-prompt.ts` (lines 374-397), `lib/risk-generator.ts`
- Why fragile: Scoring thresholds hardcoded in prompt (e.g., "FCCR >= 2.0x → 1–2"). If market benchmarks change, prompt must be updated.
- Safe modification: Extract threshold values to config. Allow adjustment per institution type (bank vs. PE).
- Test coverage: None.

## Scaling Limits

**File Upload Size Limit:**
- Current capacity: 20MB (hardcoded in app/api/extractData/route.ts line 31, marked "for testing")
- Limit: Multi-GB financial statement scans or consolidations fail.
- Scaling path: Stream-based processing. Chunk uploads. Use S3 or similar for temp storage instead of `/uploads` directory.

**OpenAI API Rate Limit:**
- Current capacity: Default OpenAI org rate limits (varies by plan, typically 3-90k tokens/min for GPT-4).
- Limit: Concurrent document processing bottleneck. Large batch uploads hit rate limits immediately.
- Scaling path: Implement queue (e.g., Bull/BullMQ). Stagger extraction to respect token-per-minute limits. Consider batch API endpoint if OpenAI offers.

**Sequential Processing Throughput:**
- Current capacity: ~1 document/2min with 2-4 chunks (typical 100KB report).
- Limit: Cannot handle >5 concurrent uploads without queueing.
- Scaling path: Parallelize chunk processing (requires deterministic merge redesign). Load-test against concurrent requests.

**In-Memory State Management:**
- Current capacity: All project data, extracted metrics, and assessments held in React state. No database.
- Limit: Cannot serve more than one concurrent browser tab per user. Refresh loses all state. Horizontal scaling impossible.
- Scaling path: Implement database persistence. Add server-side session management.

**No Batch Processing:**
- Current capacity: Single-file extraction only. No bulk analysis or batch mode.
- Limit: Competitive disadvantage against tools supporting portfolio analysis.
- Scaling path: Implement batch extraction API. Queue background jobs. Stream results incrementally.

## Dependencies at Risk

**pdf2json (Version 3.1.6):**
- Risk: Older PDF parser library. Security vulnerabilities possible. Not actively maintained (last commit >1 year ago on some forks).
- Impact: PDF parsing failures. Potential RCE if processing malicious PDFs.
- Migration plan: Evaluate pdfjs-dist (already in dependencies) as primary parser. Test compatibility with current extraction pipeline.

**formidable (Version 3.5.2):**
- Risk: Form parsing library. No known active vulnerabilities but not widely audited. Custom headers assignment via `as any` (route.ts line 43) bypasses type safety.
- Impact: Form parsing edge cases could cause crashes.
- Migration plan: Update to latest. Consider multer (already in dependencies) as alternative. Test streaming parser with large files.

**pdf-parse (Version 1.1.1):**
- Risk: Community-maintained PDF extraction. Lacks active maintenance. Used in document-parser.ts but inconsistently with pdfjs-dist also in deps.
- Impact: Extraction failures on newer PDFs. Duplicate parser dependencies.
- Migration plan: Consolidate on pdfjs-dist or pdf-lib. Remove pdf-parse if unused after consolidation.

**OpenAI SDK (Version 4.89.0):**
- Risk: Dependency on external API. Pricing model can change. Rate limiting behavior is opaque.
- Impact: Cost overruns possible. Rate limit errors not gracefully handled.
- Migration plan: Implement cost tracking. Consider caching common extractions (e.g., standard financial templates). Evaluate alternative models (Anthropic Claude, local LLMs).

## Missing Critical Features

**No Persistent Data Storage:**
- Problem: All extracted data lost on page refresh. Cannot compare historical analyses or track portfolio.
- Blocks: Portfolio risk management. Historical trend analysis. Multi-user collaboration.
- Priority: CRITICAL. Blocks core use case.

**No Authentication/User Management:**
- Problem: Supabase integration exists but is unused. Anyone with the URL can upload documents and see results.
- Blocks: Multi-user tenancy. Data privacy compliance. Audit trails.
- Priority: CRITICAL for production. Medium if MVP only.

**No Audit Trail:**
- Problem: No record of who extracted what data, when, or what changes were made.
- Blocks: Regulatory compliance. Dispute resolution. Forensic analysis.
- Priority: HIGH for financial institutions. Will be required post-MVP.

**No Manual Override / Adjustment Workflow:**
- Problem: AI extraction is immutable. User cannot correct extraction errors (e.g., misclassified debt, missed adjustments) post-hoc.
- Blocks: Accuracy in edge cases. User trust. Risk assessment refinement.
- Priority: HIGH. Current app is read-only after extraction.

**No Export to Standard Formats:**
- Problem: Results cannot be exported as PDF, Excel, or imported into accounting software.
- Blocks: Integration with downstream workflows. Client deliverables.
- Priority: MEDIUM. Needed for adoption.

**No Scenario/Sensitivity Analysis:**
- Problem: Cannot adjust assumptions (e.g., "What if EBITDA increases 10%?") to see impact on ratios and risk scores.
- Blocks: Lending underwriting workflows. Deal stress testing.
- Priority: MEDIUM. Adds value to analysis.

## Test Coverage Gaps

**EBITDA Calculation Not Tested:**
- What's not tested: Adjusted EBITDA formula with all component combinations. Handling of null/missing fields. Edge cases (zero EBITDA, negative adjustments).
- Files: `lib/calculations/ebitda-calculator.ts` (lines 30-185)
- Risk: Formula errors go undetected. Reference values in comments (Zedcor FY2024: $7,541K) are not validated.
- Priority: HIGH. Core calculation.

**FCCR / DSCR Ratios Not Tested:**
- What's not tested: Different CapEx treatment modes. Zero debt service (division by zero). Null fallback chains.
- Files: `lib/calculations/fccr-calculator.ts`, `lib/calculations/dscr-calculator.ts`
- Risk: Ratio calculation errors. Silent null returns when inputs are incomplete.
- Priority: HIGH. Lender-critical ratios.

**AI Extraction Merger Not Tested:**
- What's not tested: Conflict resolution. Multi-chunk extraction with conflicting values. Edge cases (empty extractions, malformed JSON).
- Files: `lib/extraction-merger.ts`
- Risk: Merge logic errors propagate to final results. Cannot verify determinism.
- Priority: HIGH. Central to data pipeline.

**Risk Assessment Scoring Not Tested:**
- What's not tested: Scoring algorithm against known risk profiles. Threshold boundary cases. Impact of missing metrics on scoring.
- Files: `lib/risk-generator.ts`
- Risk: Risk scores inaccurate or inconsistent. User trust eroded.
- Priority: MEDIUM. Scoring logic complex.

**Document Parsing Not Tested:**
- What's not tested: Different PDF/Excel/Word formats. Corrupted files. Large files (>20MB edge cases).
- Files: `lib/document-parser.ts`
- Risk: Crashes on unexpected formats. Silent data loss on corrupted files.
- Priority: MEDIUM. Robustness issue.

**UI Components Not Tested:**
- What's not tested: File upload flow (compression, progress simulation, error states). Data display rendering. Tab switching with missing data.
- Files: `components/FileUpload.tsx`, `components/FinancialTable.tsx`, `components/WeightedRiskGauge.tsx`
- Risk: UI crashes on edge case data. Poor user experience. Silent state inconsistencies.
- Priority: LOW to MEDIUM. Depends on user feedback.

---

*Concerns audit: 2026-02-05*
