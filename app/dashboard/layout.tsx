'use client';

import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserButton } from '@clerk/nextjs';
import CommandPalette from '@/components/CommandPalette';
import { PanelLeft } from 'lucide-react';

function DashboardHeader() {
  const { toggleSidebar, state } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/90 backdrop-blur-md px-4">
      <button
        onClick={toggleSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className={`h-4 w-4 transition-transform ${state === 'collapsed' ? 'rotate-180' : ''}`} />
      </button>
      <div className="flex items-center gap-3">
        <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground font-mono select-none">
          <span>⌘</span>K
        </kbd>
        <ThemeToggle />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      {/* CommandPalette is rendered here so it is always mounted within the
          dashboard session and can respond to Cmd+K from any route. */}
      <CommandPalette />
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
