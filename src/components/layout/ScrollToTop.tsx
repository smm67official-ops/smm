'use client';

import { useEffect, useState } from 'react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <a
      href="#wrapper"
      id="back-top-top"
      aria-label="Back to top"
      onClick={(e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      style={{
        position: 'fixed',
        right: '25px',
        bottom: '25px',
        zIndex: 90,
        height: '45px',
        width: '45px',
        lineHeight: '45px',
        textAlign: 'center',
        borderRadius: '3px',
        background: '#f2ba59',
        color: '#ffffff',
        fontSize: '22px',
      }}
    >
      <i className="ion-android-arrow-up" />
    </a>
  );
}
