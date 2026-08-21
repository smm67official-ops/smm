import type { SVGProps } from 'react';

/**
 * Jeu d'icônes minimal, trait 1.75px, cohérent avec la typographie.
 * Aucune dépendance externe : les icônes héritent de `currentColor`.
 */
export const ICON_PATHS = {
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7',
  close: 'M6 6l12 12M18 6L6 18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 19v-1a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7a4 4 0 01-3 3.87',
  heart: 'M20.4 5.6a5 5 0 00-7.1 0L12 6.9l-1.3-1.3a5 5 0 10-7.1 7.1l1.3 1.3L12 21l7.1-7a1 1 0 000 0l1.3-1.3a5 5 0 000-7.1z',
  trendingUp: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  trendingDown: 'M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  bolt: 'M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z',
  wallet: 'M3 7h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0a2 2 0 012-2h11M17 13h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 7.5h.01',
  alert: 'M12 3l9.5 16.5H2.5L12 3zM12 10v4M12 17.5h.01',
  arrowRight: 'M4 12h16M14 6l6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  filter: 'M3 5h18M6 12h12M10 19h4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
  refresh: 'M21 12a9 9 0 11-2.6-6.4M21 3v6h-6',
  card: 'M2 8h20M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM6 15h4',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export default function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
