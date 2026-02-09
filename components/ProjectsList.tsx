'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  FolderOpen,
  Clock,
  Search,
  Filter,
  Trash2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Project } from '@/lib/supabase/types';

interface ProjectsListProps {
  initialProjects: Project[];
}

const getRiskColor = (score: number | null) => {
  if (score === null) return 'bg-gray-100 text-gray-600';
  if (score <= 4) return 'bg-green-100 text-green-700';
  if (score <= 6) return 'bg-yellow-100 text-yellow-700';
  if (score <= 8) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    case 'archived':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-yellow-100 text-yellow-700';
  }
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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function ProjectsList({ initialProjects }: ProjectsListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (project.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleStartEdit = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleSaveEdit = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();

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

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(null);
    setEditingName('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, projectId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(e as unknown as React.MouseEvent, projectId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">
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

      {/* Search and Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Project Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Link key={project.id} href={`/dashboard/${project.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingId === project.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, project.id)}
                              className="h-7 text-sm"
                              disabled={isSaving}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
                              onClick={(e) => handleSaveEdit(e, project.id)}
                              disabled={isSaving}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-gray-500 hover:text-gray-700 shrink-0"
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                              {project.name}
                            </CardTitle>
                            <CardDescription className="text-xs truncate">
                              {project.company_name || project.description || 'No description'}
                            </CardDescription>
                          </>
                        )}
                      </div>
                    </div>
                    {editingId !== project.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-gray-700"
                          onClick={(e) => handleStartEdit(e, project)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteProject(e, project.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(
                          project.status
                        )}`}
                      >
                        {formatStatus(project.status)}
                      </span>
                      {project.risk_score !== null && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getRiskColor(
                            project.risk_score
                          )}`}
                        >
                          Risk: {project.risk_score.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatDate(project.updated_at)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <FolderOpen className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">No projects found</h3>
              <p className="text-sm text-gray-500 mt-1">
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
        </Card>
      )}
    </div>
  );
}
