interface TechnicalLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function TechnicalLabel({
  children,
  className = '',
}: TechnicalLabelProps) {
  return (
    <span
      className={`text-xs font-medium tracking-wide uppercase text-muted-foreground ${className}`}
    >
      {children}
    </span>
  );
}
