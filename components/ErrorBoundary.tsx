'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the entire application.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 *
 * // With error callback
 * <ErrorBoundary onError={(error, info) => logToService(error, info)}>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 * ```
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback UI to display when an error occurs */
  fallback?: React.ReactNode;
  /** Callback fired when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Optional title for the error message */
  errorTitle?: string;
  /** Whether to show the retry button */
  showRetry?: boolean;
  /** Whether to show error details (for development) */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console for development
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): React.ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const {
      children,
      fallback,
      errorTitle = 'Something went wrong',
      showRetry = true,
      showDetails = process.env.NODE_ENV === 'development',
    } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <Card className="border-error/20 bg-error/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-error" />
              <h3 className="text-lg font-semibold text-error">{errorTitle}</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred while rendering this section. Your
              other data is safe.
            </p>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription className="font-mono text-xs">
                  {error.message}
                </AlertDescription>
              </Alert>
            )}

            {showDetails && errorInfo && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View component stack trace
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-muted-foreground">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </CardContent>
          {showRetry && (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </CardFooter>
          )}
        </Card>
      );
    }

    return children;
  }
}

/**
 * Compact Error Boundary
 *
 * A smaller version for inline use within tables or cards.
 */
export class CompactErrorBoundary extends React.Component<
  Omit<ErrorBoundaryProps, 'showDetails'>,
  ErrorBoundaryState
> {
  constructor(props: Omit<ErrorBoundaryProps, 'showDetails'>) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('CompactErrorBoundary caught an error:', error);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, showRetry = true } = this.props;

    if (hasError) {
      if (fallback) return fallback;

      return (
        <div className="flex items-center gap-2 rounded border border-error/20 bg-error/5 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
          <span className="text-muted-foreground">
            {error?.message || 'Error loading content'}
          </span>
          {showRetry && (
            <button
              onClick={this.handleRetry}
              className="ml-auto text-xs text-primary hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher-order component to wrap any component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithErrorBoundary;
}

export default ErrorBoundary;
