import Link from 'next/link';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/nextjs';

export default function HomePage() {
  const videos = [
    '/backgrounds/STG_crash.mp4',
    '/backgrounds/STG_crash (1).mp4',
    '/backgrounds/STG_crash (2).mp4',
    '/backgrounds/STG_vSnap.mp4',
    '/backgrounds/STG_vSnap (1).mp4',
    '/backgrounds/STG_vSnap (2).mp4',
  ];

  const randomVideo = videos[Math.floor(Math.random() * videos.length)];

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src={randomVideo} type="video/mp4" />
      </video>

      {/* Minimal nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-[2%] flex items-center justify-between bg-white">
        <Link
          href="/"
          className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
        >
          Lendflow
        </Link>
        <div className="flex items-center gap-4">
          <SignedOut>
            <Link
              href="/sign-up"
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
            >
              Get Started
            </Link>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="text-sm font-medium text-neutral-900 hover:text-neutral-600 transition-colors">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
            >
              Dashboard
            </Link>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />
          </SignedIn>
        </div>
      </nav>

      {/* Hero - Swiss design with cropped typography */}
      <main className="flex-1 flex items-center justify-center overflow-hidden relative z-10">
        <div className="relative h-screen flex flex-col items-center justify-center">
          {/* Oversized cropped text */}
          {/* <h1 className="text-[20vw] md:text-[18vw] lg:text-[16vw] font-bold tracking-tighter text-neutral-900 select-none leading-[0.85] whitespace-nowrap">
            Lendflow
          </h1> */}

          {/* Tagline below, left aligned flush with L */}
          {/* <div className="mt-6 md:mt-8 self-start">
            <p className="text-sm md:text-base font-medium text-neutral-600 mb-1">
              AI-Powered Risk Analysis
            </p>
            <p className="text-sm md:text-base text-neutral-400">
              Transform financial documents into actionable lending
              insights.
            </p>
          </div> */}
        </div>
      </main>
    </div>
  );
}
