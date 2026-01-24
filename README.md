This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
rm -rf .next && npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


<!--  instead of DSCR lets change it to show FCCR. Gather Data: Find Adjusted EBITDA(which we have already done),
  interest expense, lease payments, capital expenditures, and taxes from financial statements.
  Calculate Numerator: Determine your available cash flow, usually EBITDA minus necessary cash outflows like
  taxes and non-financed CapEx.
  Calculate Denominator: Sum your total fixed obligations, including interest and principal (or lease
  payments).
  Divide: Divide the numerator by the denominator to get the FCCR.
  use this scale to grade FCCR:
  Excellent: > 2.0x (A ratio above 2.0 indicates a very strong, stable position with a large cushion for
  unexpected dips).
  Good: 1.5x - 2.0x (A robust, healthy position often preferred by lenders).
  Adequate: 1.2x - 1.49x (Considered acceptable by many lenders, as it is above the critical 1.0 threshold but
  warrants monitoring).
  Weak: 1.0x - 1.19x (Technically solvent, but leaves little room for error and indicates high financial risk).
  Poor: < 1.0x (A red flag indicating the company is not generating enough earnings to cover its fixed
  obligations). -->