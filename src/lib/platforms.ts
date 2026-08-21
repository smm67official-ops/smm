/** Plateformes affichées dans le carrousel et utilisées pour filtrer le catalogue. */
export const PLATFORMS = [
  { slug: 'instagram', label: 'Instagram', icon: 'ion-social-instagram-outline', color: '#e4405f', match: ['instagram', 'insta', 'انستقرام', 'انستيجرام'] },
  { slug: 'tiktok', label: 'TikTok', icon: 'ion-music-note', color: '#000000', match: ['tiktok', 'tik tok', 'تيك توك'] },
  { slug: 'youtube', label: 'YouTube', icon: 'ion-social-youtube', color: '#cd201f', match: ['youtube', 'يوتيوب'] },
  { slug: 'facebook', label: 'Facebook', icon: 'ion-social-facebook', color: '#3b5999', match: ['facebook', 'فيسبوك'] },
  { slug: 'twitter', label: 'Twitter / X', icon: 'ion-social-twitter', color: '#000000', match: ['twitter', ' x ', 'تويتر'] },
  { slug: 'telegram', label: 'Telegram', icon: 'ion-paper-airplane', color: '#0088cc', match: ['telegram', 'تيليجرام'] },
  { slug: 'snapchat', label: 'Snapchat', icon: 'ion-chatbubble', color: '#fffc00', match: ['snapchat', 'سناب'] },
  { slug: 'spotify', label: 'Spotify', icon: 'ion-headphone', color: '#1db954', match: ['spotify', 'سبوتيفاي'] },
  { slug: 'twitch', label: 'Twitch', icon: 'ion-videocamera', color: '#9146ff', match: ['twitch', 'تويتش'] },
  { slug: 'discord', label: 'Discord', icon: 'ion-chatboxes', color: '#5865f2', match: ['discord', 'ديسكورد'] },
  { slug: 'whatsapp', label: 'WhatsApp', icon: 'ion-android-chat', color: '#25d366', match: ['whatsapp', 'واتس'] },
  { slug: 'threads', label: 'Threads', icon: 'ion-at', color: '#000000', match: ['threads', 'ثريدز'] },
  { slug: 'linkedin', label: 'LinkedIn', icon: 'ion-social-linkedin', color: '#0077b5', match: ['linkedin'] },
  { slug: 'pinterest', label: 'Pinterest', icon: 'ion-social-pinterest', color: '#bd081c', match: ['pinterest', 'بينتريست'] },
  { slug: 'reddit', label: 'Reddit', icon: 'ion-social-reddit', color: '#ff5700', match: ['reddit', 'ريديت'] },
  { slug: 'soundcloud', label: 'SoundCloud', icon: 'ion-ios-cloud', color: '#ff3300', match: ['soundcloud'] },
] as const;

export type PlatformSlug = (typeof PLATFORMS)[number]['slug'];

/** Déduit la plateforme depuis le libellé de catégorie du fournisseur. */
export function detectPlatform(categoryName: string): PlatformSlug | null {
  const haystack = ` ${categoryName.toLowerCase()} `;
  for (const platform of PLATFORMS) {
    if (platform.match.some((needle) => haystack.includes(needle))) return platform.slug;
  }
  return null;
}

export const platformOf = (slug: string | null | undefined) =>
  PLATFORMS.find((p) => p.slug === slug) ?? null;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'category';
