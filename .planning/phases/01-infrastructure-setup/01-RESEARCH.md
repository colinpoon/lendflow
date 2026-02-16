# Phase 1: Infrastructure Setup - Research

**Researched:** 2026-02-15
**Domain:** PDF-to-image conversion + Claude Vision API integration
**Confidence:** HIGH

## Summary

This research covers the infrastructure needed for vision-based financial document extraction: PDF-to-image conversion and Claude 3.7 Sonnet Vision API integration with structured output via tool calling.

The project already has `canvas` (v3.1.0) and `pdfjs-dist` (v3.10.111) installed, which are the core dependencies for PDF rendering. The recommended approach is to use `pdf-to-img` library which leverages these dependencies with a clean API. For Claude integration, use the official `@anthropic-ai/sdk` TypeScript SDK with tool calling to enforce structured JSON output matching the existing `ExtractedMetrics` schema.

The key insight is that tool calling with `tool_choice: { type: "tool", name: "extract_financials" }` guarantees Claude returns structured JSON matching the defined schema, eliminating the need for fragile response parsing.

**Primary recommendation:** Use pdf-to-img (v5.x) for PDF conversion with scale factor 4.17 (equivalent to 300 DPI), and @anthropic-ai/sdk with a single extraction tool that matches the existing ExtractedMetrics TypeScript interface.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdf-to-img` | ^5.0.0 | PDF page to PNG conversion | Built on pdfjs-dist, pure JS, no native binaries beyond canvas |
| `@anthropic-ai/sdk` | ^0.74.0 | Claude API TypeScript client | Official Anthropic SDK with full TypeScript support |
| `canvas` | ^3.1.0 | PDF rendering backend | Already installed in project, required by pdf-to-img |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pdfjs-dist` | ^3.10.111 | PDF parsing engine | Already installed, used internally by pdf-to-img |
| `zod` | ^3.25.0+ | Schema validation | Optional: for betaZodTool helper with strict type checking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdf-to-img | pdf2pic | Requires GraphicsMagick + Ghostscript system dependencies |
| pdf-to-img | @ikilabs/pdf-to-img | Fork with viewportScale option, less maintained |
| pdf-to-img | IronPDF | Commercial license, more features but overkill for PoC |

**Installation:**
```bash
npm install pdf-to-img @anthropic-ai/sdk
```

Note: `canvas` and `pdfjs-dist` already installed in project.

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── vision/
│   ├── pdf-converter.ts     # PDF to image conversion
│   ├── claude-client.ts     # Claude Vision API client
│   ├── extraction-tool.ts   # Tool definition for structured output
│   └── index.ts             # Public exports
utils/
├── aiProcessor.ts           # Existing - add vision extraction path
```

### Pattern 1: PDF-to-Image Conversion
**What:** Convert PDF pages to high-quality PNG images for vision analysis
**When to use:** Before sending any PDF page to Claude Vision API
**Example:**
```typescript
// Source: https://github.com/k-yle/pdf-to-img README
import { pdf } from 'pdf-to-img';

interface ConversionOptions {
  scale: number; // 4.17 = ~300 DPI (72 DPI base * 4.17)
}

export async function convertPdfToImages(
  pdfPath: string,
  options: ConversionOptions = { scale: 4.17 }
): Promise<Buffer[]> {
  const document = await pdf(pdfPath, { scale: options.scale });
  const images: Buffer[] = [];

  for await (const page of document) {
    images.push(page); // Each page is a PNG Buffer
  }

  return images;
}

// For specific pages:
export async function convertPdfPage(
  pdfPath: string,
  pageNumber: number,
  scale: number = 4.17
): Promise<Buffer> {
  const document = await pdf(pdfPath, { scale });
  return document.getPage(pageNumber);
}
```

### Pattern 2: Claude Vision API with Base64 Images
**What:** Send images to Claude with proper base64 encoding
**When to use:** Sending converted PDF pages for analysis
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/vision
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function analyzeImage(
  imageBuffer: Buffer,
  prompt: string
): Promise<string> {
  const base64Data = imageBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514', // Claude 3.7 Sonnet
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Data // Raw base64, NOT data URL
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ]
  });

  return response.content[0].type === 'text'
    ? response.content[0].text
    : '';
}
```

### Pattern 3: Structured Output via Tool Calling
**What:** Force Claude to return structured JSON by defining a tool
**When to use:** When you need guaranteed schema-conformant output
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedMetrics } from '@/types';

const client = new Anthropic();

// Define extraction tool with JSON Schema matching ExtractedMetrics
const extractionTool = {
  name: 'extract_financial_metrics',
  description: 'Extract financial metrics from a financial document image. Call this tool with the extracted data.',
  input_schema: {
    type: 'object',
    properties: {
      fiscal_year: {
        type: 'string',
        description: 'The fiscal year (e.g., "2023", "FY2023")'
      },
      revenue: {
        type: 'number',
        nullable: true,
        description: 'Total revenue/sales in thousands USD'
      },
      net_income: {
        type: 'number',
        nullable: true,
        description: 'Net income/profit in thousands USD'
      },
      // ... all other ExtractedMetrics fields
      ebitda: {
        type: 'number',
        nullable: true,
        description: 'EBITDA if explicitly stated in document'
      },
      depreciation_amortization: {
        type: 'number',
        nullable: true,
        description: 'Total depreciation and amortization expense'
      }
      // Include all fields from ExtractedMetrics interface
    },
    required: ['fiscal_year']
  }
};

export async function extractFinancials(
  imageBuffer: Buffer
): Promise<Record<string, ExtractedMetrics>> {
  const base64Data = imageBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [extractionTool],
    tool_choice: { type: 'tool', name: 'extract_financial_metrics' }, // Force tool use
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Data
            }
          },
          {
            type: 'text',
            text: `Extract all financial metrics from this financial document image.

Look for:
- Income statement items: revenue, net income, expenses, interest, taxes, depreciation/amortization
- Balance sheet items: total debt, senior debt, shareholders equity
- EBITDA and adjusted EBITDA if stated
- All values should be in thousands USD

Call the extract_financial_metrics tool with the extracted data.`
          }
        ]
      }
    ]
  });

  // Extract tool call result
  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use') {
    const extracted = toolUse.input as ExtractedMetrics & { fiscal_year: string };
    return { [extracted.fiscal_year]: extracted };
  }

  throw new Error('No extraction result from Claude');
}
```

### Pattern 4: Environment Configuration
**What:** Proper API key management
**When to use:** Always - never hardcode API keys
**Example:**
```typescript
// .env.local
ANTHROPIC_API_KEY=sk-ant-...

// lib/vision/claude-client.ts
import Anthropic from '@anthropic-ai/sdk';

// SDK reads ANTHROPIC_API_KEY from environment automatically
const client = new Anthropic();

// Or explicit configuration:
const clientExplicit = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

### Anti-Patterns to Avoid
- **Parsing JSON from text responses:** Use tool calling instead of asking Claude to return JSON in text and parsing it
- **Using data URLs for images:** The API expects raw base64, not `data:image/png;base64,...` format
- **Ignoring image size limits:** Images over 1568px on long edge get resized automatically, increasing latency
- **Processing in parallel without rate limiting:** Anthropic API has rate limits; use sequential processing for PoC

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF rendering | Custom pdfjs-dist integration | pdf-to-img | Handles canvas setup, page iteration, memory management |
| API request/retry | Custom fetch with retries | @anthropic-ai/sdk | Built-in retry logic, proper error handling, TypeScript types |
| JSON schema validation | Manual JSON parsing | Tool calling with input_schema | Claude validates against schema before returning |
| Base64 encoding | Custom encoding logic | Buffer.toString('base64') | Built-in Node.js, handles edge cases |
| Image resizing | Custom canvas resize | Let Claude resize | API automatically resizes; pre-resize only if optimizing latency |

**Key insight:** Tool calling eliminates the "parse JSON from text" problem entirely. Claude returns structured data matching your schema, or the API returns an error.

## Common Pitfalls

### Pitfall 1: Wrong Base64 Format
**What goes wrong:** API returns "invalid image data" error
**Why it happens:** Sending data URL format instead of raw base64
**How to avoid:** Never include `data:image/png;base64,` prefix
**Warning signs:** Error message mentions "invalid base64" or "unsupported image format"

```typescript
// WRONG
const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

// CORRECT
const base64 = buffer.toString('base64');
```

### Pitfall 2: Insufficient Image Resolution
**What goes wrong:** Claude misreads numbers in tables (e.g., reads 1,234 as 1,284)
**Why it happens:** Low DPI images cause OCR-like errors on small text
**How to avoid:** Use scale factor 4.17 (300 DPI equivalent) minimum
**Warning signs:** Extracted numbers don't match document, especially in dense tables

```typescript
// Default scale=3 may be insufficient for financial tables
const document = await pdf(pdfPath, { scale: 4.17 }); // 300 DPI
```

### Pitfall 3: Not Forcing Tool Use
**What goes wrong:** Claude returns prose description instead of structured data
**Why it happens:** Without tool_choice, Claude may decide not to use tools
**How to avoid:** Always use `tool_choice: { type: 'tool', name: 'your_tool' }`
**Warning signs:** Response contains text content instead of tool_use content

### Pitfall 4: Missing API Key Configuration
**What goes wrong:** SDK throws "authentication failed" on first request
**Why it happens:** ANTHROPIC_API_KEY not in environment
**How to avoid:** Add to .env.local, verify in runtime check
**Warning signs:** Error occurs immediately on client instantiation

```typescript
// Add validation on startup
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}
```

### Pitfall 5: Canvas Native Module Issues
**What goes wrong:** `npm install` fails or runtime errors on canvas import
**Why it happens:** Node-canvas requires native compilation, may fail on some systems
**How to avoid:** Project already has canvas@3.1.0 working; don't upgrade without testing
**Warning signs:** Build errors mentioning "node-gyp", "prebuild", or architecture mismatch

## Code Examples

Verified patterns from official sources:

### Complete Vision Extraction Function
```typescript
// Source: Combined from Anthropic docs
import Anthropic from '@anthropic-ai/sdk';
import { pdf } from 'pdf-to-img';
import type { ExtractedMetrics } from '@/types';

const client = new Anthropic();

const EXTRACTION_TOOL = {
  name: 'extract_financial_metrics',
  description: 'Extract financial metrics from a financial document image',
  input_schema: {
    type: 'object',
    properties: {
      fiscal_year: { type: 'string' },
      revenue: { type: 'number', nullable: true },
      net_income: { type: 'number', nullable: true },
      expenses: { type: 'number', nullable: true },
      interest: { type: 'number', nullable: true },
      taxes: { type: 'number', nullable: true },
      depreciation_amortization: { type: 'number', nullable: true },
      ebitda: { type: 'number', nullable: true },
      total_debt: { type: 'number', nullable: true },
      senior_debt: { type: 'number', nullable: true },
      shareholders_equity: { type: 'number', nullable: true }
    },
    required: ['fiscal_year']
  }
};

export async function extractFromPdf(
  pdfPath: string
): Promise<Record<string, ExtractedMetrics>> {
  // Convert PDF to images
  const document = await pdf(pdfPath, { scale: 4.17 });
  const results: Record<string, ExtractedMetrics> = {};

  let pageNum = 1;
  for await (const pageBuffer of document) {
    console.log(`Processing page ${pageNum}...`);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_financial_metrics' },
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: pageBuffer.toString('base64')
            }
          },
          {
            type: 'text',
            text: 'Extract all financial metrics from this page. All monetary values in thousands USD.'
          }
        ]
      }]
    });

    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (toolUse && toolUse.type === 'tool_use') {
      const data = toolUse.input as ExtractedMetrics & { fiscal_year: string };
      const year = data.fiscal_year;

      // Merge with existing year data if present
      if (results[year]) {
        results[year] = { ...results[year], ...data };
      } else {
        results[year] = data;
      }
    }

    pageNum++;
  }

  return results;
}
```

### Testing Vision API Connection
```typescript
// Quick test to verify API setup
import Anthropic from '@anthropic-ai/sdk';

async function testVisionAPI(): Promise<boolean> {
  const client = new Anthropic();

  // Create a simple test image (1x1 white PNG)
  const testImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: testImage.toString('base64')
            }
          },
          { type: 'text', text: 'Describe this image briefly.' }
        ]
      }]
    });

    console.log('Vision API test successful');
    return true;
  } catch (error) {
    console.error('Vision API test failed:', error);
    return false;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PDF text extraction | Vision-based extraction | Claude 3 (2024) | Tables/layouts now accurately extracted |
| JSON parsing from text | Tool calling | Claude 3+ | Guaranteed structured output |
| Function calling | Tool use | 2024 | Unified API for all tool types |
| claude-3-sonnet-20240229 | claude-sonnet-4-20250514 | 2025 | Current Claude 3.7 Sonnet model ID |

**Deprecated/outdated:**
- `claude-2` models: No vision support
- Text-based extraction prompts: Less accurate than vision for tables
- Manual JSON parsing: Replaced by tool calling

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal Scale Factor for Financial Documents**
   - What we know: Default scale=3, docs suggest higher for "high resolution images"
   - What's unclear: Exact optimal value for dense financial tables
   - Recommendation: Start with 4.17 (300 DPI), test and adjust based on accuracy

2. **Multi-Page Document Handling Strategy**
   - What we know: Financial data often spans multiple pages
   - What's unclear: Best approach for merging extractions across pages
   - Recommendation: Extract per-page, merge by fiscal year (existing merger code applies)

3. **Claude 3.7 Sonnet Model ID**
   - What we know: Documentation references `claude-sonnet-4-20250514` as current
   - What's unclear: Whether "Claude 3.7 Sonnet" maps to different model ID
   - Recommendation: Use `claude-sonnet-4-20250514` or verify with `claude-3-7-sonnet-latest`

## Sources

### Primary (HIGH confidence)
- [Anthropic Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) - Image API format, size limits, best practices
- [Anthropic Tool Use Documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) - Tool calling, tool_choice, structured output
- [Anthropic Implement Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) - Forcing tool use, error handling
- [pdf-to-img GitHub](https://github.com/k-yle/pdf-to-img) - Library usage, scale option, Node.js v20+ requirement

### Secondary (MEDIUM confidence)
- [npm @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) - Current version 0.74.0, published Feb 2026
- [npm pdf-to-img](https://www.npmjs.com/package/pdf-to-img) - Current version 5.0.0, Node.js v20+ requirement

### Tertiary (LOW confidence)
- WebSearch results for Claude 3.7 Sonnet capabilities - Model naming/versioning may have changed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs and npm packages verified
- Architecture: HIGH - Patterns from official Anthropic documentation
- Pitfalls: MEDIUM - Based on documentation warnings and general experience

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - Anthropic SDK is actively developed)
