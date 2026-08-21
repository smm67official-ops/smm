'use client';

import Link from 'next/link';
import Marquee from '@/components/ui/Marquee';
import { PLATFORMS } from '@/lib/platforms';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/** Carrousel infini de tous les logos de plateformes (deux sens opposés). */
export default function PlatformsSwiper({
  locale,
  t,
  availablePlatforms = [],
}: {
  locale: Locale;
  t: Dictionary;
  availablePlatforms?: string[];
}) {
  const items = PLATFORMS.map((platform) => {
    const available = availablePlatforms.length === 0 || availablePlatforms.includes(platform.slug);
    return (
      <Link
        key={platform.slug}
        href={`/${locale}/services?platform=${platform.slug}`}
        className="tm-platform"
        title={platform.label}
      >
        <span className="tm-platform-icon" style={{ backgroundColor: platform.color }}>
          <i className={platform.icon} />
        </span>
        <span className="tm-platform-label">{platform.label}</span>
        {!available && <span className="tm-platform-soon">•</span>}
      </Link>
    );
  });

  return (
    <div className="tm-section tm-platforms-area bg-white tm-padding-section-sm">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-12">
            <div className="tm-sectiontitle text-center">
              <h3>{t.platforms.title}</h3>
              <p>{t.platforms.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <Marquee speed={45}>{items}</Marquee>
      <Marquee speed={55} reverse className="mt-20">
        {[...items].reverse()}
      </Marquee>
    </div>
  );
}
