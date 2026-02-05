# External Integrations

**Analysis Date:** 2026-02-05

## APIs & External Services

**AI/LLM:**
- OpenAI GPT-4 Turbo - Financial metric extraction from documents
  - SDK/Client: openai 4.89.0
  - Auth: Environment variable `OPENAI_API_KEY`
  - Model: `gpt-4-turbo-2024-04-09`
  - Integration points:
    - `lib/chunk-processor.ts` - Sequential chunk processing with retry logic (max 3 attempts)
    - `lib/risk-generator.ts` - Risk assessment and debt health evaluation
    - `lib/extraction-reconciler.ts` - AI-powered conflict resolution between extractions
  - Config: Temperature 0 (deterministic), max_tokens 2000, batch delay 3000ms, rate limit backoff 15000ms

## Data Storage

**Databases:**
- Supabase - PostgreSQL-based backend (configuration present but package not installed)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL=https://rppvicoeyzpmbwgrbfhy.supabase.co`
  - Auth Key: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...`
  - Client: @supabase/ssr (not in package.json, imported in code)
  - Usage: `app/instruments/page.tsx` queries `instruments` table
  - Status: Defined but incomplete - missing actual dependency installation

**File Storage:**
- Local filesystem only
  - Upload directory: `uploads/` (created at `/[cwd]/uploads` in `app/api/extractData/route.ts`)
  - Supported formats: PDF, Excel (.xlsx), Word (via pdf-parse, xlsx, pdf2json)
  - Max file size: 20MB

**Caching:**
- In-memory cache during processing
- Cache directory: `lendflow-cache` (configurable in `lib/constants.ts`)
- Temporary cache cleared on dev server restart

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (configured but not installed/active)
  - Implementation: SSR-compatible auth via `@supabase/ssr`
  - Cookie-based session management in `utils/supabase/server.ts`
  - Browser client setup in `utils/supabase/client.ts`
  - Middleware integration in `utils/supabase/middleware.ts`

**Current Status:**
- No active authentication in main upload flow (`app/api/extractData/route.ts`)
- Public API endpoint without auth guards
- Supabase setup files present but dependency missing from package.json

## Monitoring & Observability

**Error Tracking:**
- Not detected - no Sentry, DataDog, or similar integration

**Logs:**
- Console-based logging via `console.log()` and `console.error()`
- Structured logs in:
  - `app/api/extractData/route.ts` - File upload pipeline
  - `utils/aiProcessor.ts` - AI extraction phases
  - `lib/chunk-processor.ts` - Chunk processing progress
  - Debug logs for EBITDA, FCCR, and DSCR calculations

## CI/CD & Deployment

**Hosting:**
- Not detected (Next.js deployable to Vercel, AWS, self-hosted)

**CI Pipeline:**
- Not detected - no GitHub Actions, GitLab CI, or similar

## Environment Configuration

**Required env vars:**
- `OPENAI_API_KEY` - Critical, must be set before app starts (validated in `utils/aiProcessor.ts`)

**Optional env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase endpoint (exposed to browser)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Supabase public key (safe to expose)

**Secrets location:**
- `.env` file (committed to git - security risk, credentials exposed)
- No `.env.example` or `.env.local` pattern for safe configuration

**Security Issues:**
- API keys and Supabase credentials hardcoded in `.env` and visible in repository
- Consider using `.env.local` for development and environment-based secrets in production
- Supabase password visible in comments in `.env`

## Webhooks & Callbacks

**Incoming:**
- `/api/extractData` (POST) - Main financial document processing endpoint
  - Accepts multipart form data (PDF, Excel, Word files)
  - Returns JSON with extracted metrics, ratios, and risk assessment

**Outgoing:**
- None detected

## Document Processing Pipeline

**File Types Supported:**
- PDF - Parsed via `pdf-parse`, `pdfjs-dist`, `pdf2json`
- Excel (.xlsx) - Parsed via `xlsx`
- Word (.docx) - Text extraction via `pdf-parse`
- Plain text

**Processing Flow:**
1. File upload to `/api/extractData` → `app/api/extractData/route.ts`
2. Formidable multipart parsing → `uploads/` directory
3. Document parsing → `lib/document-parser.ts`
4. Text chunking (8000 char chunks) → `lib/chunk-processor.ts`
5. Deduplication via SHA256 hash
6. Sequential OpenAI API calls per chunk
7. Extraction merging → `lib/extraction-merger.ts`
8. Financial metric computation → `utils/aiProcessor.ts`
9. Risk assessment generation → `lib/risk-generator.ts`
10. JSON response to client

## Rate Limiting

**OpenAI API:**
- Retry logic: Max 3 attempts per chunk
- Rate limit backoff: 15000ms (15 seconds) on 429 responses
- Batch processing: Sequential (not parallel) for determinism
- Chunk size: 8000 characters
- Max tokens per response: 2000

## External Data Sources

**Financial Data:**
- All data extracted from user-uploaded documents via OpenAI GPT-4
- No external financial APIs (Bloomberg, S&P, FactSet, etc.) integrated
- No real-time market data or reference rates

---

*Integration audit: 2026-02-05*
