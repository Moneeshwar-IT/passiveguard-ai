import React from 'react';
import { motion } from 'framer-motion';

export default function SummaryCard({ title, value, subtitle, icon: Icon, color = 'cyan', trend }) {
  const colorMap = {
    cyan: {
      badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      text: 'text-cyan-400',
      borderTop: 'border-t-2 border-t-cyan-400',
      hoverGlow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]',
    },
    blue: {
      badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      text: 'text-cyan-400',
      borderTop: 'border-t-2 border-t-cyan-400',
      hoverGlow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]',
    },
    indigo: {
      badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      text: 'text-indigo-400',
      borderTop: 'border-t-2 border-t-indigo-400',
      hoverGlow: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]',
    },
    purple: {
      badge: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      text: 'text-purple-400',
      borderTop: 'border-t-2 border-t-purple-400',
      hoverGlow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]',
    },
    red: {
      badge: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      text: 'text-rose-400',
      borderTop: 'border-t-2 border-t-rose-500',
      hoverGlow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]',
    },
    amber: {
      badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-400',
      borderTop: 'border-t-2 border-t-amber-400',
      hoverGlow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]',
    },
    green: {
      badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-400',
      borderTop: 'border-t-2 border-t-emerald-400',
      hoverGlow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]',
    },
  };

  const styleObj = colorMap[color] || colorMap.cyan;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`bg-slate-900/80 backdrop-blur-md border border-slate-800/80 ${styleObj.borderTop} ${styleObj.hoverGlow} rounded-xl p-4 transition-all duration-200 shadow-lg group flex flex-col justify-between cursor-pointer`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
          {Icon && (
            <div className={`p-2 rounded-lg border ${styleObj.badge} group-hover:scale-110 transition-transform duration-200`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight">{value}</div>
      </div>
      {subtitle && (
        <div className="text-[11px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span>{subtitle}</span>
          {trend && <span className={`font-mono font-bold ${styleObj.text}`}>{trend}</span>}
        </div>
      )}
    </motion.div>
  );
}
