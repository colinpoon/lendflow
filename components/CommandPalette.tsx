'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Plus, LayoutDashboard } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Project } from '@/lib/supabase/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns Tailwind classes for a risk score badge.
 * Mirrors the getRiskBadgeClasses pattern from ProjectsList so visual
 * treatment is consistent across the application.
 */
const getRiskBadgeClasses = (score: number | null): string => {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score <= 4) return 'bg-success/15 text-success border-success/25';
  if (score <= 6) return 'bg-warning/15 text-warning border-warning/25';
  return 'bg-error/15 text-error border-error/25';
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Register Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch projects once when the palette opens, not on every keystroke
  const fetchProjects = useCallback(async () => {
    if (isFetching || projects.length > 0) return;

    setIsFetching(true);
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data: Project[] = await response.json();
      setProjects(data);
    } catch (err) {
      console.error('[CommandPalette] Failed to load projects:', err);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, projects.length]);

  useEffect(() => {
    if (open) fetchProjects();
  }, [open, fetchProjects]);

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search projects or type a command"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search projects or type a command..." />
      <CommandList>
        <CommandEmpty>
          {isFetching ? 'Loading projects...' : 'No results found.'}
        </CommandEmpty>

        {/* Quick actions */}
        <CommandGroup heading="Actions">
          <CommandItem
            value="new analysis create"
            onSelect={() => navigate('/dashboard/new')}
          >
            <Plus className="text-muted-foreground" />
            <span>New Analysis</span>
          </CommandItem>
          <CommandItem
            value="projects dashboard home"
            onSelect={() => navigate('/dashboard')}
          >
            <LayoutDashboard className="text-muted-foreground" />
            <span>Projects</span>
          </CommandItem>
        </CommandGroup>

        {/* Project results */}
        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  // Include company name in the searchable value so cmdk
                  // filters by both project name and company name
                  value={`${project.name} ${project.company_name ?? ''} ${project.id}`}
                  onSelect={() => navigate(`/dashboard/${project.id}`)}
                >
                  <FolderOpen className="text-muted-foreground shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium leading-tight">
                      {project.name}
                    </span>
                    {project.company_name && (
                      <span className="truncate text-xs text-muted-foreground leading-tight">
                        {project.company_name}
                      </span>
                    )}
                  </div>
                  {project.risk_score !== null && (
                    <Badge
                      variant="outline"
                      className={`shrink-0 gap-1 text-xs tabular-nums ${getRiskBadgeClasses(project.risk_score)}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {project.risk_score.toFixed(1)}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
