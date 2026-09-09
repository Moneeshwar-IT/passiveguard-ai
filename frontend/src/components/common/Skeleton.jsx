import React from 'react';

export default function Skeleton({ className = '', variant = 'card' }) {
  if (variant === 'statRow') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-24 animate-pulse">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-3"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-4"></div>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded w-full"></div>
        ))}
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse ${className}`}>
      <div className="p-5 space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded"></div>
      </div>
    </div>
  );
}
