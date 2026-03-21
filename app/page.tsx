import Link from 'next/link';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/nextjs';
import { ArrowRight, BarChart3, FileText, ShieldCheck, Zap } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const stats = [
  { label: 'Accuracy Rate', value: '94%', sub: 'vs. manual review' },
  { label: 'Time Saved', value: '10x', sub: 'per document cycle' },
  { label: 'Metrics Tracked', value: '20+', sub: 'per fiscal year' },
];

const features = [
  {
    icon: FileText,
    title: 'Document Intelligence',
    description:
      'Upload PDF, Excel, or Word financials. The AI extracts every relevant metric automatically — revenue, EBITDA, debt service, and more.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Ratio Engine',
    description:
      'Computes DSCR, Senior Debt / Adj. EBITDA, Total Debt/Capital, and Covenant FCCR the moment extraction is complete — no spreadsheet formulas required.',
  },
  {
    icon: ShieldCheck,
    title: 'Credit-Risk Snapshot',
    description:
      'Seven-pillar risk assessment modeled after institutional lending rubrics. Each pillar is scored and weighted into a composite risk score.',
  },
  {
    icon: Zap,
    title: 'Lending Recommendation',
    description:
      'Receive a structured approve/decline recommendation with supporting rationale, ready to share with your credit committee.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const videos = [
    '/backgrounds/STG_crash.mp4',
    '/backgrounds/STG_crash (1).mp4',
    '/backgrounds/STG_crash (2).mp4',
    '/backgrounds/STG_vSnap.mp4',
    '/backgrounds/STG_vSnap (1).mp4',
    '/backgrounds/STG_vSnap (2).mp4',
  ];

  // Deterministic pick — avoids SSR/CSR mismatch without needing 'use client'
  const randomVideo = videos[0];

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">

      {/* ── Video layer (darkened) ──────────────────────────────────────────── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-[0.07]"
      >
        <source src={randomVideo} type="video/mp4" />
      </video>

      {/* ── Emerald aurora glow overlay ────────────────────────────────────── */}
      <div className="absolute inset-0 z-[1] aurora-glow pointer-events-none" />

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 h-16 flex items-center justify-between border-b border-foreground/6 bg-background/80 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
        >
          <div className="h-7 w-7 rounded-md bg-emerald-brand flex items-center justify-center text-background text-[11px] font-bold tracking-tight shrink-0">
            LF
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Lendflow
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="text-sm font-medium text-foreground/65 hover:text-foreground transition-colors">
                Sign in
              </button>
            </SignInButton>
            <Link
              href="/sign-up"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-brand text-background text-sm font-semibold hover:bg-emerald-brand-hover transition-colors"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-brand text-background text-sm font-semibold hover:bg-emerald-brand-hover transition-colors"
            >
              Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: { avatarBox: 'w-8 h-8' },
              }}
            />
          </SignedIn>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">

        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-brand/30 bg-emerald-brand-glow mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-brand" />
          <span className="text-[11px] uppercase font-medium text-emerald-brand">
            AI-Powered Credit Analysis
          </span>
        </div>

        {/* Headline */}
        <h1 className="max-w-3xl text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground">
          Lending Intelligence{' '}
          <span className="text-emerald-brand">Accelerated</span>
        </h1>

        {/* Sub-headline */}
        <p className="mt-6 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
          Upload a financial document. Receive a complete risk analysis — EBITDA,
          debt ratios, DSCR, and an institutional-grade lending recommendation —
          in minutes, not days.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
          <SignedOut>
            <Link
              href="/sign-up"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-brand text-background text-sm font-semibold hover:bg-emerald-brand-hover transition-colors shadow-lg shadow-emerald-brand/25"
            >
              Start analyzing free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="flex items-center gap-2 px-6 py-3 rounded-full border border-foreground/12 text-foreground/75 text-sm font-medium hover:border-foreground/25 hover:text-foreground transition-colors">
                Sign in to dashboard
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-brand text-background text-sm font-semibold hover:bg-emerald-brand-hover transition-colors shadow-lg shadow-emerald-brand/25"
            >
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </SignedIn>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────────── */}
        <div className="mt-20 grid grid-cols-3 gap-6 md:gap-12 max-w-xl w-full">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="text-3xl md:text-4xl font-bold tabular-nums text-foreground tracking-tight">
                {stat.value}
              </span>
              <span className="text-[10px] uppercase text-emerald-brand font-medium">
                {stat.label}
              </span>
              <span className="text-[11px] text-foreground/50">{stat.sub}</span>
            </div>
          ))}
        </div>
      </main>

      {/* ── Feature section ────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-10 pb-24">
        <div className="max-w-5xl mx-auto">

          {/* Section label */}
          <div className="text-center mb-12">
            <p className="text-[11px] uppercase text-emerald-brand font-medium mb-3">
              What it does
            </p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              From raw financials to credit decision
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="card-fintech rounded-xl p-6 group hover:border-emerald-brand/35 transition-colors duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 h-9 w-9 rounded-lg bg-emerald-brand-muted flex items-center justify-center group-hover:bg-emerald-brand-glow transition-colors">
                      <Icon className="h-4.5 w-4.5 text-emerald-brand" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1.5">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-foreground/6 px-6 md:px-10 py-6 flex items-center justify-between">
        <span className="text-[11px] text-foreground/40">
          Lendflow &copy; {new Date().getFullYear()}
        </span>
        <span className="text-[11px] text-foreground/35">
          Built for credit professionals
        </span>
      </footer>
    </div>
  );
}
