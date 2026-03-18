'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserButton } from '@clerk/nextjs';
import CommandPalette from '@/components/CommandPalette';

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <CommandPalette />
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border bg-background/90 backdrop-blur-md px-4">
          <div className="flex items-center gap-3">
            <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground font-mono select-none">
              <span>⌘</span>K
            </kbd>
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
