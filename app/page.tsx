'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Shield,
  Zap,
  TrendingUp,
  FileText,
  Lock,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Navigation bar
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10' : ''
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white">Lendflow</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">
              How It Works
            </Link>
            <Link href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">
              Pricing
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <Link href="/dashboard">Sign In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-white text-black hover:bg-white/90 rounded-full px-4"
            >
              <Link href="/dashboard">Get Started</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white/70 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-[#0a0a0a] pt-20 px-4 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col gap-4">
              <Link
                href="#features"
                className="text-lg text-white/70 py-3 border-b border-white/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-lg text-white/70 py-3 border-b border-white/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                href="#pricing"
                className="text-lg text-white/70 py-3 border-b border-white/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <div className="flex flex-col gap-3 mt-4">
                <Button asChild variant="outline" className="border-white/20 text-white">
                  <Link href="/dashboard">Sign In</Link>
                </Button>
                <Button asChild className="bg-white text-black">
                  <Link href="/dashboard">Get Started</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Floating metric component with glass morphism
function FloatingMetric({
  label,
  value,
  icon: Icon,
  position,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  position: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={`absolute ${position} hidden lg:flex items-center gap-3`}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: delay + 1, duration: 0.8, ease: 'easeOut' }}
    >
      <motion.div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, delay, ease: 'easeInOut' }}
        whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.2)' }}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
          <Icon className="w-5 h-5 text-white/80" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{value}</p>
          <p className="text-xs text-white/50">{label}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Animated gradient orb
function GradientOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        scale: [1, 1.3, 1],
        opacity: [0.2, 0.4, 0.2],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 15,
        repeat: Infinity,
        delay,
        ease: 'linear',
      }}
    />
  );
}

// Section wrapper with scroll animation
function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.section
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      transition={{ duration: 0.8, ease: 'easeOut', delay }}
    >
      {children}
    </motion.section>
  );
}

// Feature card with glow effect
function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  index: number;
  gradient: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      className="group relative p-8 rounded-2xl border border-white/10 bg-[#111111] overflow-hidden"
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
    >
      {/* Hover glow */}
      <div className={`absolute -top-24 -right-24 w-48 h-48 ${gradient} rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />

      <div className="relative">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
        <p className="text-white/50 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// Stat counter with animated number
function StatCounter({
  value,
  label,
  suffix = '',
  index,
}: {
  value: string;
  label: string;
  suffix?: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <motion.div
        className="text-4xl md:text-5xl font-bold mb-2"
        initial={{ scale: 0.5 }}
        animate={isInView ? { scale: 1 } : { scale: 0.5 }}
        transition={{ duration: 0.5, delay: index * 0.1 + 0.2, type: 'spring' }}
      >
        <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          {value}
        </span>
        <span className="text-white/40">{suffix}</span>
      </motion.div>
      <p className="text-white/50 text-sm">{label}</p>
    </motion.div>
  );
}

// Process step component
function ProcessStep({
  number,
  title,
  description,
  index,
}: {
  number: string;
  title: string;
  description: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      className="relative flex gap-6"
      initial={{ opacity: 0, x: -30 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
    >
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
          {number}
        </div>
        {index < 2 && (
          <div className="w-px h-full bg-gradient-to-b from-emerald-500/50 to-transparent mt-4" />
        )}
      </div>
      <div className="pb-12">
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-white/50 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -100]);

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Extraction',
      description:
        'Advanced machine learning algorithms automatically extract and categorize financial data from any document format.',
      gradient: 'from-yellow-500/80 to-orange-500/80',
    },
    {
      icon: BarChart3,
      title: 'Real-Time Analysis',
      description:
        'Instant calculation of FCCR, leverage ratios, and debt health indicators with detailed breakdowns.',
      gradient: 'from-emerald-500/80 to-cyan-500/80',
    },
    {
      icon: Shield,
      title: 'Risk Assessment',
      description:
        'Comprehensive weighted risk scoring with AI-generated lending recommendations and covenant suggestions.',
      gradient: 'from-blue-500/80 to-indigo-500/80',
    },
    {
      icon: TrendingUp,
      title: 'Trend Analysis',
      description:
        'Historical comparison across fiscal years to identify patterns and trajectory of financial health.',
      gradient: 'from-purple-500/80 to-pink-500/80',
    },
    {
      icon: FileText,
      title: 'Smart Document Processing',
      description:
        'Intelligent parsing of PDFs, Excel, and Word documents with automatic table and chart recognition.',
      gradient: 'from-rose-500/80 to-red-500/80',
    },
    {
      icon: Lock,
      title: 'Secure & Compliant',
      description:
        'Enterprise-grade security with data encryption and compliance with financial industry standards.',
      gradient: 'from-slate-500/80 to-gray-500/80',
    },
  ];

  const stats = [
    { value: '10x', label: 'Faster Analysis', suffix: '' },
    { value: '99', label: 'Accuracy Rate', suffix: '%' },
    { value: '50', label: 'Document Types', suffix: '+' },
    { value: '24/7', label: 'Availability', suffix: '' },
  ];

  const processSteps = [
    {
      number: '1',
      title: 'Upload Your Documents',
      description: 'Simply drag and drop your financial statements, tax returns, or any relevant documents. We support PDF, Excel, and Word formats.',
    },
    {
      number: '2',
      title: 'AI Analyzes Everything',
      description: 'Our advanced AI extracts key metrics, calculates ratios, and identifies risk factors automatically within seconds.',
    },
    {
      number: '3',
      title: 'Get Actionable Insights',
      description: 'Receive comprehensive risk assessments, lending recommendations, and suggested covenants to make informed decisions.',
    },
  ];

  return (
    <div ref={containerRef} className="bg-[#0a0a0a] text-white min-h-screen overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <motion.section
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <GradientOrb
            className="w-[800px] h-[800px] bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 top-0 -right-1/4"
            delay={0}
          />
          <GradientOrb
            className="w-[600px] h-[600px] bg-gradient-to-r from-purple-500/20 to-pink-500/20 bottom-0 -left-1/4"
            delay={5}
          />
          <GradientOrb
            className="w-[500px] h-[500px] bg-gradient-to-r from-blue-500/20 to-indigo-500/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            delay={10}
          />
        </div>

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Floating metrics */}
        <FloatingMetric
          label="FCCR"
          value="1.53x"
          icon={TrendingUp}
          position="top-[30%] left-[8%]"
          delay={0}
        />
        <FloatingMetric
          label="Debt/EBITDA"
          value="3.25x"
          icon={BarChart3}
          position="top-[25%] right-[8%]"
          delay={0.3}
        />
        <FloatingMetric
          label="Risk Score"
          value="Low Risk"
          icon={Shield}
          position="bottom-[35%] left-[5%]"
          delay={0.6}
        />
        <FloatingMetric
          label="Total Capital"
          value="$39.7M"
          icon={FileText}
          position="bottom-[30%] right-[6%]"
          delay={0.9}
        />

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm text-white/70">AI-Powered Financial Analysis</span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <span className="text-white">Instant </span>
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Risk Analysis
            </span>
            <br />
            <span className="text-white/80 text-4xl md:text-5xl lg:text-6xl">for Smarter Lending</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            Transform complex financial documents into actionable lending insights.
            AI-powered analysis that would take hours, delivered in seconds.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 rounded-full px-8 h-14 text-base font-medium group shadow-lg shadow-emerald-500/25"
            >
              <Link href="/dashboard">
                Start Free Analysis
                <ArrowUpRight className="ml-2 w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-medium backdrop-blur-sm"
            >
              <Link href="#how-it-works">
                See How It Works
                <ChevronDown className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <motion.div
            className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2"
            animate={{ borderColor: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              className="w-1 h-2 bg-white/60 rounded-full"
              animate={{ y: [0, 12, 0], opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Stats Section */}
      <AnimatedSection className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16">
            {stats.map((stat, index) => (
              <StatCounter key={stat.label} {...stat} index={index} />
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold tracking-wider uppercase mb-4">
              Simple Process
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              How It <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Get from document upload to lending decision in three simple steps.
            </p>
          </AnimatedSection>

          <div className="max-w-2xl mx-auto">
            {processSteps.map((step, index) => (
              <ProcessStep key={step.number} {...step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold tracking-wider uppercase mb-4">
              Features
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Comprehensive tools for analyzing financial documents and making informed lending decisions.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-12">
            <p className="text-emerald-400 text-sm font-semibold tracking-wider uppercase mb-4">
              Pricing
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Start Free, Scale As You Grow
            </h2>
            <p className="text-white/50">
              No credit card required. Upgrade when you need more.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div className="relative p-8 md:p-12 rounded-3xl border border-white/10 bg-[#111111] overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full blur-3xl" />
              <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-white">Free</span>
                    <span className="text-white/50">to start</span>
                  </div>
                  <p className="text-white/50 mb-4">
                    Perfect for trying out our AI-powered analysis
                  </p>
                  <ul className="space-y-2 text-sm text-white/70">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      5 document analyses per month
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Full risk assessment reports
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      AI-powered recommendations
                    </li>
                  </ul>
                </div>
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 rounded-full px-10 h-14 text-base font-medium group whitespace-nowrap"
                >
                  <Link href="/dashboard">
                    Get Started
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA Section */}
      <AnimatedSection className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative p-12 md:p-20 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Ready to Transform Your
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Lending Process?
                </span>
              </h2>
              <p className="text-white/50 mb-10 max-w-lg mx-auto text-lg">
                Join forward-thinking financial institutions using AI to make faster, smarter lending decisions.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-white text-black hover:bg-white/90 rounded-full px-12 h-16 text-lg font-medium group"
              >
                <Link href="/dashboard">
                  Start Your Free Analysis
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="py-16 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-white">Lendflow</span>
            </div>

            <div className="flex items-center gap-8 text-sm text-white/50">
              <Link href="#features" className="hover:text-white transition-colors">Features</Link>
              <Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
              <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/40">
              &copy; {new Date().getFullYear()} Lendflow. All rights reserved.
            </p>
            <p className="text-sm text-white/40">
              Built with AI for smarter lending decisions
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
