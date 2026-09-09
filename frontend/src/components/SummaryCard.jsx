import React from 'react';
import StatCard from './common/StatCard';

export default function SummaryCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  // Map color names to StatCard variant types
  const variantMap = {
    cyan: 'brand',
    blue: 'brand',
    indigo: 'indigo',
    purple: 'ai',
    red: 'danger',
    amber: 'warning',
    green: 'success',
  };

  const variant = variantMap[color] || 'brand';

  return (
    <StatCard
      title={title}
      value={value}
      subtitle={subtitle}
      icon={Icon}
      variant={variant}
      trend={trend}
    />
  );
}
