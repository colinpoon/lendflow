'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

const getRiskBadgeClasses = (score: number | null) => {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score <= 4) return 'bg-success/15 text-success border-success/25';
  if (score <= 6) return 'bg-warning/15 text-warning border-warning/25';
  return 'bg-error/15 text-error border-error/25';
};

const formatStatus = (status: string) => {
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

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
  // CRUD handlers
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
        alert(data.error || 'Failed to update project name');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project name');
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

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== projectId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Sortable column header
  // ─────────────────────────────────────────────────────────────────────────

  const SortableHead = ({ label, sortKeyName, className = '' }: { label: string; sortKeyName: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button
        onClick={() => toggleSort(sortKeyName)}
        className="flex items-center gap-1 hover:text-foreground transition-colors text-xs uppercase tracking-widest font-medium"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </button>
    </TableHead>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your financial analysis projects
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            New Analysis
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      {filteredProjects.length > 0 ? (
        <div className="border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead label="Project" sortKeyName="name" className="w-[40%]" />
                <SortableHead label="Status" sortKeyName="status" />
                <SortableHead label="Risk" sortKeyName="risk_score" className="text-right" />
                <SortableHead label="Updated" sortKeyName="updated_at" className="text-right" />
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => {
                    if (editingId !== project.id) router.push(`/dashboard/${project.id}`);
                  }}
                >
                  <TableCell>
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
                          onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditingName(''); }}
                          disabled={isSaving}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="font-medium tracking-tight truncate">
                          {project.name}
                        </p>
                        {(project.company_name || project.description) && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {project.company_name || project.description}
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(project.status)}>
                      {formatStatus(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {project.risk_score !== null ? (
                      <Badge
                        variant="outline"
                        className={getRiskBadgeClasses(project.risk_score)}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        <span className="tabular-nums">{project.risk_score.toFixed(1)}</span>
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(project.updated_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                          onClick={(e) => handleDeleteProject(e, project.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight text-foreground">No projects found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Upload a financial document to get started'}
              </p>
            </div>
            {!searchQuery && (
              <Button asChild className="mt-2">
                <Link href="/dashboard/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Analysis
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Count */}
      {filteredProjects.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-3 tabular-nums">
          {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}
    </div>
  );
}
