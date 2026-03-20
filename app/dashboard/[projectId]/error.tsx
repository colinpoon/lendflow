'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Project page error:', error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Card className="border-error/20 bg-error/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-error" />
            <h3 className="text-lg font-semibold text-error">Failed to load project</h3>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            An error occurred while loading the project data. This may be a temporary issue.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-3 max-h-32 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
