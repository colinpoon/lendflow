# Technology Stack

**Analysis Date:** 2026-02-05

## Languages

**Primary:**
- TypeScript 5.x - Full codebase including React components and Node.js server-side code
- TSX/JSX - React component files in `app/` and `components/`

**Secondary:**
- CSS/Tailwind - Styling via Tailwind CSS v4

## Runtime

**Environment:**
- Node.js (version unspecified, no .nvmrc present)

**Package Manager:**
- npm
- Lockfile: package-lock.json (standard with npm)

## Frameworks

**Core:**
- Next.js 15.2.4 - Full-stack React framework with Turbopack (see `app/` directory)
- React 19.0.0 - UI library with server/client components
- React DOM 19.0.0 - DOM rendering

**Testing:**
- Not detected in current setup

**Build/Dev:**
- Turbopack - Fast bundler integrated in Next.js dev server (`npm run dev --turbopack`)
- TypeScript compiler - Strict type checking
- ESLint 9.x - Code linting (via eslint-config-next)
- Tailwind CSS 4.x - Utility-first CSS framework with PostCSS support

## Key Dependencies

**Critical:**
- openai 4.89.0 - GPT-4 Turbo API client for financial data extraction (`lib/chunk-processor.ts`, `lib/risk-generator.ts`, `lib/extraction-reconciler.ts`)
- @supabase/ssr - Supabase auth/database integration for SSR environments (in code but not in package.json - status unclear)

**Infrastructure:**
- formidable 3.5.2 - Multipart form parsing for file uploads (`app/api/extractData/route.ts`)
- pdf-parse 1.1.1 - PDF text extraction
- pdf2json 3.1.6 - Alternative PDF parsing
- pdfjs-dist 3.10.111 - PDF.js distribution
- pdf-lib 1.17.1 - PDF manipulation
- xlsx 0.18.5 - Excel/spreadsheet parsing
- canvas 3.1.0 - Node.js canvas for image operations (aliased false in browser via webpack config)

**UI Components:**
- @shadcn/ui 0.0.4 - Headless UI component library
- @radix-ui/react-* (latest versions) - Primitive components (accordion, dialog, label, progress, separator, slot, tabs, tooltip)
- lucide-react 0.484.0 - SVG icon library
- framer-motion 12.29.0 - Animation library
- class-variance-authority 0.7.1 - Component variant utility
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.0.2 - Tailwind class merging for conflicts
- tw-animate-css 1.2.4 - Animation utilities

**HTTP & Data:**
- axios 1.8.4 - HTTP client (installed but usage not detected in API code)

**Utilities:**
- dotenv 16.4.7 - Environment variable loading
- multer 1.4.5-lts.2 - Alternative to formidable (installed but not used, formidable preferred)
- fs 0.0.1-security - Dummy package (Node.js fs is built-in)

## Configuration

**Environment:**
- Required: `OPENAI_API_KEY` - OpenAI API authentication
- Optional: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Supabase configuration (present in .env but Supabase not in package.json)
- Supabase credentials in `.env` file (exposed - security concern)

**Build:**
- `tsconfig.json` - TypeScript strict mode enabled, target ES2017
- `next.config.ts` - Webpack config to alias canvas as false in browser
- Path alias: `@/*` → root directory
- Tailwind config: Default Tailwind CSS 4 configuration
- PostCSS: Auto-configured by Tailwind CSS 4

**Package Management:**
- `package.json` uses `patch-package` for post-install patches
- `postinstall` script runs `patch-package` after npm install
- React version overrides: ^19.0.0 enforced across dependencies

## Platform Requirements

**Development:**
- Node.js (version not specified)
- npm
- Modern browser for front-end development

**Production:**
- Node.js runtime (minimal version v18+ recommended for Next.js 15)
- 20+ MB disk space for uploads (`app/api/extractData/route.ts` sets 20MB file limit)
- OpenAI API key with sufficient quota for GPT-4 Turbo

---

*Stack analysis: 2026-02-05*
