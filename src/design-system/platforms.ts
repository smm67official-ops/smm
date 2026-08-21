/**
 * Plateformes sociales du marketplace.
 * Les couleurs de marque servent uniquement d'accent d'identification :
 * la palette de l'application reste bleu / lavande / violet.
 */
export const SV_PLATFORMS = {
  instagram: { label: 'Instagram', color: '#E1306C' },
  tiktok: { label: 'TikTok', color: '#111111' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  x: { label: 'X', color: '#000000' },
  telegram: { label: 'Telegram', color: '#229ED9' },
  facebook: { label: 'Facebook', color: '#1877F2' },
} as const;

export type SvPlatform = keyof typeof SV_PLATFORMS;

export const platformColor = (platform?: SvPlatform) =>
  platform ? SV_PLATFORMS[platform].color : 'var(--sv-primary)';

export const platformLabel = (platform?: SvPlatform) =>
  platform ? SV_PLATFORMS[platform].label : '';

/** Variable CSS `--sv-platform` consommée par les composants. */
export const platformStyle = (platform?: SvPlatform) =>
  ({ ['--sv-platform' as string]: platformColor(platform) }) as React.CSSProperties;
