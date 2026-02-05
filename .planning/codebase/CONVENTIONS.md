# Coding Conventions

**Analysis Date:** 2026-02-05

## Naming Patterns

**Files:**
- Component files: PascalCase (e.g., `FileUpload.tsx`, `RiskAssessment.tsx`)
- Utility/library files: camelCase (e.g., `aiProcessor.ts`, `chunk-processor.ts`)
- API routes: descriptive lowercase with hyphens in path (e.g., `/api/extractData/route.ts`)
- Type definition files: camelCase (e.g., `ebitda-calculator.ts`, `extraction-prompt.ts`)

**Functions:**
- Regular functions: camelCase (e.g., `extractFinancialData`, `calculateEBITDA`, `compressPDF`)
- React components: PascalCase (e.g., `FileUpload`, `RiskAssessment`)
- Async functions: camelCase (e.g., `parseDocument`, `processChunk`)
- Private/helper functions: camelCase with descriptive intent (e.g., `validateMetrics`, `logAdjustedEBITDA`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`, `CHUNK_SIZE`, `TOTAL_ESTIMATED_SECONDS`)
- Configuration objects: camelCase with `Config` suffix (e.g., `AI_CONFIG`, `CACHE_CONFIG`)
- React state: camelCase (e.g., `stage`, `progress`, `extractedData`)
- Type instances: camelCase (e.g., `computed`, `merged`, `validationIssues`)

**Types:**
- Interfaces: PascalCase with descriptive names (e.g., `FileUploadProps`, `ExtractionResult`, `ComputedMetrics`)
- Type aliases: PascalCase (e.g., `ProcessingStage`)
- Exported types from files: centralized in `types/` directory as PascalCase interfaces

## Code Style

**Formatting:**
- Framework: None enforced in package.json (no prettier/biome config)
- ESLint extends Next.js core-web-vitals and Next.js TypeScript
- Uses TypeScript strict mode (`"strict": true` in tsconfig.json)
- Target: ES2017
- Module resolution: bundler

**Linting:**
- Tool: ESLint 9
- Config file: `eslint.config.mjs`
- Extends: `next/core-web-vitals` and `next/typescript`
- Command: `npm run lint`

## Import Organization

**Order:**
1. External packages (e.g., `import React from 'react'`, `import OpenAI from 'openai'`)
2. Next.js imports (e.g., `import { NextRequest, NextResponse } from 'next/server'`)
3. Absolute imports using `@/` alias (e.g., `import { extractFinancialData } from '@/utils/aiProcessor'`)
4. Type-only imports marked with `import type` (e.g., `import type { ComputedMetrics } from '@/types'`)

**Path Aliases:**
- All imports use `@/` prefix for absolute paths
- Base mapping: `"@/*": ["./*"]` in tsconfig.json
- Structure: `@/components`, `@/lib`, `@/utils`, `@/types`, `@/app`

## Error Handling

**Patterns:**
- Try-catch blocks wrap async operations and potential errors
- API routes return `NextResponse.json()` with status codes
- Error messages use emojis for console visibility (e.g., `❗`, `⚠️`, `✅`, `📊`)
- Client components use `alert()` for user-facing errors
- Detailed console logging on errors with `error.message` and error stacks
- No custom error classes; uses built-in Error type with descriptive messages
- Validation errors thrown explicitly: `throw new Error('descriptive message')`

Examples:
```typescript
// API route error handling
try {
  const data = await extractFinancialData(resolvedPath);
  return NextResponse.json({ financialMetrics: data });
} catch (error: any) {
  console.error('❗ Error processing file:', error.message);
  return NextResponse.json(
    { error: 'Internal server error', details: error.message },
    { status: 500 }
  );
}

// Client-side fetch error handling
try {
  const response = await fetch('/api/extractData', { method: 'POST', body: formData });
  if (response.status === 413) throw new Error('File too large.');
  if (!response.ok) throw new Error('Upload failed');
  const data = await response.json();
} catch (error: any) {
  alert(error.message);
}
```

## Logging

**Framework:** Console methods only (`console.log`, `console.error`, `console.warn`)

**Patterns:**
- Use emoji prefixes for log severity: `✅` (success), `❗` (error), `⚠️` (warning), `📊` (data), `📂` (file ops)
- Log at key phase boundaries (e.g., "Phase 1: Document Parsing")
- Include specific values being logged: `console.log(\`Processing ${chunks.length} chunks\`)`
- Structured multi-line logs for complex data: formatted with spacing and alignment
- No structured logging libraries; direct console output
- Sensitive data logged in detailed sections marked with `DEBUG:` comments

Examples:
```typescript
console.log(`✅ Prepared ${textChunks.length} text chunk(s) for analysis.`);
console.error('❗ AI processing failed:', error?.message || error);
console.log(`\n📊 EBITDA COMPONENTS (Extracted):`);
console.log(`   net_income: ${m.net_income}`);
```

## Comments

**When to Comment:**
- Technical decisions requiring explanation (e.g., "Disposal losses intentionally excluded for conservative underwriting")
- Non-obvious logic (e.g., why gain/loss values need Math.abs() normalization)
- Important gotchas or caveats for maintainers
- Algorithm references or financial formula sources
- Phase boundaries and major section separators using visual dividers

**JSDoc/TSDoc:**
- Used for exported functions and interfaces
- Includes parameter descriptions, return type descriptions, and usage examples where helpful
- Example format:
```typescript
/**
 * Extract financial data from an uploaded document
 * Main entry point for the AI extraction pipeline
 *
 * @param filePath - Path to the document (PDF, Excel, or text)
 * @returns Extracted financial metrics, ratios, and risk assessments
 */
export const extractFinancialData = async (filePath: string): Promise<ExtractionResult> => {
```

**Section Dividers:**
- Visual separator: `// ─────────────────────────────────────────────────────────────────────────`
- Used to separate major function sections and logical blocks
- Makes long files more scannable

## Function Design

**Size:** No strict limits, but functions focused on single responsibility. Complex orchestration functions (like `computeMetrics`) can be 100+ lines due to sequential calculation phases.

**Parameters:**
- Use destructuring for interfaces: `function calculateAdjustedEBITDA(ebitda: number, metrics: ExtractedMetrics)`
- Type all parameters explicitly
- Optional parameters use `?` (e.g., `onUploadStart?: () => void`)
- Props interfaces required for React components (e.g., `interface FileUploadProps`)

**Return Values:**
- Always type return values explicitly
- Use `async` for operations returning Promises
- Return early from functions to reduce nesting
- Return null or undefined for missing values (not empty strings or false)
- Destructured returns for multiple values (e.g., `{ fccr, numerator, denominator }`)

## Module Design

**Exports:**
- Named exports for individual functions and types
- Default exports for React components only
- Barrel files used for organizing exports: `lib/calculations/index.ts` re-exports all calculation modules
- Type-only exports marked: `export type { ComputedMetrics } from '@/types'`

**Barrel Files:**
- `types/index.ts`: re-exports all type definitions
- `lib/calculations/index.ts`: re-exports all calculator functions
- Simplifies imports: `import { calculateEBITDA } from '@/lib/calculations'`

**File Organization:**
- Co-located logic: calculators live in `lib/calculations/`
- Prompts separated: `lib/prompts/` contains AI prompts for extraction and reconciliation
- Utils split by domain: `utils/formatters.ts` for display formatting, `utils/aiProcessor.ts` for orchestration
- Components separated by feature: `components/` contains UI components, `components/ui/` contains shadcn components

## Type Patterns

**Null handling:**
- Use `| null` explicitly in type unions (e.g., `number | null`)
- Check with `!=` or `== null` to handle both null and undefined
- Coalesce operators: `value ?? defaultValue`

**Optional types:**
- Use `?` for optional object properties: `amount?: number`
- Avoid making everything optional; be explicit about what can be missing

**Const assertions:**
- Used for configuration objects: `as const` suffix
- Example: `export const AI_CONFIG = { ... } as const;`

**Record types:**
- Used for maps and dictionaries: `Record<string, ComputedMetrics>`
- Used for year-indexed data: `metrics_by_year: Record<string, ComputedMetrics>`

---

*Convention analysis: 2026-02-05*
