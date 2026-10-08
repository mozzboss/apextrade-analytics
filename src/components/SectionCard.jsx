import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionCard({ title, icon: Icon, action, children, className, bodyClassName }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card overflow-hidden', className)}>
      {title && (
        <header className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            {title}
          </h3>
          {action}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}