import { ImageResponse } from 'next/og';
import { getDictionary } from '@/i18n';
import { BRAND } from '@/lib/brand';
import { truncate } from '@/lib/seo';

/**
 * Vignette de partage (Facebook, WhatsApp, X, LinkedIn).
 *
 * Générée plutôt que fournie en fichier : le logo existant fait 96 px de
 * côté, très en dessous des 1200x630 attendus. Un réseau social qui
 * reçoit une image trop petite l'ignore et affiche un lien nu — celui
 * qu'on partage le plus souvent, justement.
 *
 * Aucune police externe n'est chargée : un `fetch` au build est une
 * dépendance réseau de plus, et l'échec se traduirait par une image
 * absente sans message clair.
 */
export const runtime = 'nodejs';
export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Params = Promise<{ locale: string }>;

export default async function OpengraphImage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 44 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 76,
              height: 76,
              borderRadius: 20,
              background: '#6366f1',
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            67
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{BRAND.name}</span>
            <span style={{ fontSize: 22, color: '#a5b4fc' }}>{BRAND.tagline}</span>
          </div>
        </div>

        {/* Borné : au-delà, le texte déborde de la vignette au lieu de
            se réduire. La coupe respecte les mots. */}
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, lineHeight: 1.18 }}>
          {truncate(t.meta.title, 110)}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 26,
            lineHeight: 1.45,
            color: '#cbd5e1',
          }}
        >
          {truncate(t.meta.description, 145)}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            fontSize: 24,
            color: '#818cf8',
            fontWeight: 600,
          }}
        >
          {BRAND.url.replace('https://', '')}
        </div>
      </div>
    ),
    size
  );
}
