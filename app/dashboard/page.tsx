'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  FolderOpen,
  Clock,
  MoreHorizontal,
  Search,
  Filter,
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

// Mock project data - will be replaced with real data later
const mockProjects = [
  {
    id: '1',
    name: 'Zedcor Inc. Analysis',
    description: 'Q4 2023 Financial Review',
    status: 'completed',
    riskScore: 5.5,
    lastUpdated: '2024-01-15',
  },
  {
    id: '2',
    name: 'TechStart Holdings',
    description: 'Series B Due Diligence',
    status: 'in_progress',
    riskScore: null,
    lastUpdated: '2024-01-18',
  },
  {
    id: '3',
    name: 'Metro Manufacturing',
    description: 'Annual Credit Review',
    status: 'completed',
    riskScore: 3.2,
    lastUpdated: '2024-01-10',
  },
];

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
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = mockProjects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            New Project
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
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {project.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
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
                        {project.status === 'in_progress'
                          ? 'In Progress'
                          : 'Completed'}
                      </span>
                      {project.riskScore !== null && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getRiskColor(
                            project.riskScore
                          )}`}
                        >
                          Risk: {project.riskScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {project.lastUpdated}
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
                  : 'Create your first project to get started'}
              </p>
            </div>
            {!searchQuery && (
              <Button asChild className="mt-2">
                <Link href="/dashboard/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Link>
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
