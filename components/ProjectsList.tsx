'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  FolderOpen,
  Search,
  Trash2,
  Pencil,
  Check,
  X,
  MoreHorizontal,
  ArrowUpDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Project } from '@/lib/supabase/types';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectsListProps {
  initialProjects: Project[];
}

type SortKey = 'name' | 'status' | 'risk_score' | 'updated_at';
type SortDir = 'asc' | 'desc';

const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'in_progress':
      return 'secondary';
    default:
      return 'outline';
  }
};

/**
 * Returns Tailwind class strings for the risk score badge background,
 * text, and border based on the numeric score (1–10 scale).
 */
const getRiskBadgeClasses = (score: number | null): string => {
  if (score === null) return 'bg-muted text-muted-foreground border-transparent';
  if (score <= 4) return 'bg-success/15 text-success border-success/25';
  if (score <= 6) return 'bg-warning/15 text-warning border-warning/25';
  return 'bg-error/15 text-error border-error/25';
};

/**
 * Returns a semantic label and dot color for the risk score range.
 */
const getRiskMeta = (score: number | null): { label: string; dotClass: string } => {
  if (score === null) return { label: 'No score', dotClass: 'bg-muted-foreground' };
  if (score <= 4) return { label: 'Low', dotClass: 'bg-success' };
  if (score <= 6) return { label: 'Moderate', dotClass: 'bg-warning' };
  return { label: 'High', dotClass: 'bg-error' };
};

const formatStatus = (status: string): string => {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'Draft';
  }
};

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectsList({ initialProjects }: ProjectsListProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Filtering & Sorting
  // ─────────────────────────────────────────────────────────────────────────

  const filteredProjects = projects
    .filter(
      (project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (project.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    )
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'risk_score':
          return ((a.risk_score ?? 999) - (b.risk_score ?? 999)) * dir;
        case 'updated_at':
          return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * dir;
        default:
          return 0;
      }
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'updated_at' ? 'desc' : 'asc');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleStartEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const persistEdit = async (projectId: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (response.ok) {
        setProjects(
          projects.map((p) =>
            p.id === projectId ? { ...p, name: editingName.trim() } : p
          )
        );
        setEditingId(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update project name');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, projectId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      persistEdit(projectId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== projectId));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Sortable column header sub-component
  // ─────────────────────────────────────────────────────────────────────────

  const SortableHead = ({
    label,
    sortKeyName,
    className = '',
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        onClick={() => toggleSort(sortKeyName)}
        className="flex items-center gap-1 hover:text-foreground transition-colors text-[11px] uppercase tracking-[0.10em] font-medium"
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 transition-colors ${
            sortKey === sortKeyName ? 'text-foreground' : 'text-muted-foreground/40'
          }`}
        />
      </button>
    </TableHead>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your financial analysis projects
          </p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            New Analysis
          </Link>
        </Button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search projects..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Data Table ─────────────────────────────────────────────────────── */}
      {filteredProjects.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/40">
                <SortableHead label="Project" sortKeyName="name" className="w-[42%] pl-4" />
                <SortableHead label="Status" sortKeyName="status" className="hidden sm:table-cell" />
                <SortableHead label="Risk Score" sortKeyName="risk_score" className="text-right" />
                <SortableHead label="Updated" sortKeyName="updated_at" className="hidden md:table-cell text-right" />
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => {
                const riskMeta = getRiskMeta(project.risk_score);
                return (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer group transition-colors"
                    onClick={() => {
                      if (editingId !== project.id) router.push(`/dashboard/${project.id}`);
                    }}
                  >
                    {/* Project name / company */}
                    <TableCell className="pl-4 py-3.5">
                      {editingId === project.id ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, project.id)}
                            className="h-7 text-sm max-w-xs"
                            disabled={isSaving}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-success hover:text-success hover:bg-success/10 shrink-0"
                            onClick={(e) => { e.stopPropagation(); persistEdit(project.id); }}
                            disabled={isSaving}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                              setEditingName('');
                            }}
                            disabled={isSaving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex items-center gap-3">
                          {/* Color-coded left accent */}
                          <div
                            className={[
                              'h-8 w-0.5 rounded-full shrink-0 transition-opacity',
                              project.risk_score === null
                                ? 'bg-border opacity-0 group-hover:opacity-100'
                                : project.risk_score <= 4
                                ? 'bg-success opacity-60 group-hover:opacity-100'
                                : project.risk_score <= 6
                                ? 'bg-warning opacity-60 group-hover:opacity-100'
                                : 'bg-error opacity-60 group-hover:opacity-100',
                            ].join(' ')}
                          />
                          <div className="min-w-0">
                            <p className="font-medium tracking-tight truncate text-sm">
                              {project.name}
                            </p>
                            {(project.company_name || project.description) && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {project.company_name || project.description}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>

                    {/* Status — hidden on mobile */}
                    <TableCell className="hidden sm:table-cell py-3.5">
                      <Badge variant={getStatusVariant(project.status)} className="text-[11px]">
                        {formatStatus(project.status)}
                      </Badge>
                    </TableCell>

                    {/* Risk score — enhanced badge with label */}
                    <TableCell className="text-right py-3.5">
                      {project.risk_score !== null ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          {/* Mini bar indicator */}
                          <div className="hidden sm:flex flex-col gap-0.5 items-end">
                            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                              {riskMeta.label}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`${getRiskBadgeClasses(project.risk_score)} gap-1.5 font-mono text-xs tabular-nums`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${riskMeta.dotClass} shrink-0`}
                            />
                            {project.risk_score.toFixed(1)}
                          </Badge>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <TrendingUp className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-xs text-muted-foreground/60">Pending</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Updated date — hidden on mobile and tablet */}
                    <TableCell className="hidden md:table-cell text-right py-3.5">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(project.updated_at)}
                      </span>
                    </TableCell>

                    {/* Row actions */}
                    <TableCell className="py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={(e) => handleStartEdit(e, project)}>
                            <Pencil className="h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteProjectId(project.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        // ── Empty state ─────────────────────────────────────────────────────
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 sm:p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold tracking-tight text-foreground">
                {searchQuery ? 'No results found' : 'No projects yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {searchQuery
                  ? `No projects matching "${searchQuery}". Try a different search term.`
                  : 'Upload a financial document to create your first analysis.'}
              </p>
            </div>
            {!searchQuery && (
              <Button asChild className="mt-2 gap-2">
                <Link href="/dashboard/new">
                  <Plus className="h-4 w-4" />
                  New Analysis
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Row count ──────────────────────────────────────────────────────── */}
      {filteredProjects.length > 0 && (
        <p className="text-[11px] text-muted-foreground/60 mt-3 tabular-nums">
          {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}

      {/* Project Delete Confirmation Dialog */}
      <AlertDialog open={deleteProjectId !== null} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the project and all its extracted data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error hover:bg-error/90 text-white"
              onClick={() => {
                if (deleteProjectId) {
                  handleDeleteProject(deleteProjectId);
                  setDeleteProjectId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
