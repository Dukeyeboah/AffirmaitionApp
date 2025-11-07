'use client';

import { Card } from '@/components/ui/card';
import type { Category } from './category-grid';
import { cn } from '@/lib/utils';

interface CategoryCardProps {
  category: Category;
  onClick: () => void;
  delay?: number;
  duration?: number;
}

export function CategoryCard({
  category,
  onClick,
  delay = 0,
  duration = 6,
}: CategoryCardProps) {
  const Icon = category.icon;

  return (
    <Card
      className={cn(
        'border-none',
        'group relative overflow-hidden cursor-pointer transition-all duration-300 backdrop-blur-md',
        'hover:scale-105 hover:shadow-xl',
        'animate-float',
        'transition-transform duration-300'
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, ${category.gradient.from}, ${category.gradient.to})`,
        animationDelay: `${-delay}s`,
        animationDuration: `${duration}s`,
      }}
      onClick={onClick}
    >
      <div className='p-6 space-y-4 flex flex-col justify-center items-center'>
        <div
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center',
            'bg-white/30 shadow-sm shadow-black/5 transition-transform duration-300 backdrop-blur',
            'group-hover:scale-110'
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, ${category.gradient.from}, ${category.gradient.to})`,
          }}
        >
          <Icon className='w-7 h-7 text-slate-700' />
        </div>

        <div>
          <h3 className='text-lg text-shadow-md shadow-black/40 text-card-foreground text-balance text-pretty'>
            {category.title}
          </h3>
        </div>
      </div>

      {/* Subtle hover effect */}
      <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
    </Card>
  );
}
