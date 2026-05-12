'use client';

export const motion = {
  page: 'opacity 160ms ease, transform 160ms ease',
  surface: 'box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
  row: 'background-color 120ms ease, color 120ms ease',
  drawer: 'transform 180ms ease, opacity 180ms ease'
} as const;

export const reducedMotionMedia = '@media (prefers-reduced-motion: reduce)';
