import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold tracking-tight">
          LF
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Lendflow</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered credit risk analysis</p>
        </div>
      </div>
      <SignIn />
    </div>
  );
}
