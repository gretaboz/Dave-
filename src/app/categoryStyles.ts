import type { CSSProperties } from 'react';
import type { Project } from '../model/types';

// One presentation-only palette for category folders and both upstream maps.
// Keep the existing map's hue progression; reviews never change a category's hue.
export function categoryStyle(project: Project, id: string): CSSProperties {
  const categories = [...project.categories].sort((a, b) => a.order - b.order);
  const index = categories.findIndex(category => category.id === id);
  return {
    '--category-surface': index < 0
      ? 'var(--color-surface-secondary)'
      : `hsl(${(index * 137.5 + 75) % 360} 24% 94%)`,
  } as CSSProperties;
}
