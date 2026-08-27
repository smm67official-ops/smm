'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Icon, useToast } from '@/design-system';
import type { BalanceReport } from '@/lib/balance';

const money = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `$${Number(value).toFixed(2)}`;

/**
 * Ancienneté lisible.
 *
 * `Date.now()` ne peut PAS être appelé au rendu : le serveur et le
 * navigateur l'évaluent à des instants différents, et React signale une
 * divergence d'hydratation. La valeur relative n'est donc calculée
 * qu'après montage — voir `RelativeTime`.
 */
const ago = (iso: string, now: number) => {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)}h ago`;
};

/**
 * Affiche l'heure absolue au premier rendu — identique des deux côtés —
 * puis bascule sur l'écart relatif une fois monté.
 */
function RelativeTime({ iso, prefix }: { iso: string | null; prefix: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!iso) return <>{prefix} never</>;
  if (now === null) return <>{prefix} {new Date(iso).toISOString().slice(11, 16)} UTC</>;
  return <>{prefix} {ago(iso, now)}</>;
}

const STATUS_TONE = { LIVE: 'success', STALE: 'warning', ERROR: 'error' } as const;

/**
 * Rapprochement fournisseur / plateforme.
 *
 * Affiche l'écart sans jamais le corriger : une correction automatique
 * effacerait la trace de l'incident et rendrait l'enquête impossible.
 * Un écart critique est donc montré tel quel, chiffré, avec de quoi le
 * comprendre.
 */
export default function BalanceVerification({ initial }: { initial: BalanceReport }) {
  const { toast } = useToast();
  const [report, setReport] = useState(initial);
  const [busy, setBusy] = useState(false);

  const recheck = async () => {
    setBusy(true);

    const response = await fetch('/api/admin/balance/verify');
    const result = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok || !result) {
      toast({ tone: 'error', title: 'Verification failed', description: result?.error });
      return;
    }

    setReport(result as BalanceReport);
    toast({
      tone: result.consistent ? 'success' : 'error',
      title: result.consistent ? 'Balances are consistent' : 'Inconsistency detected',
    });
  };

  const { provider } = report;

  return (
    <>
      <div className="gp-stat-grid gp-stat-grid--3" data-reveal>
        <article className="gp-stat-card" data-reveal-item>
          <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--blue" aria-hidden="true">
            <Icon name="bolt" size={19} />
          </span>
          <div className="gp-stat-card__body">
            <p className="gp-stat-card__label">
              SMMGen balance <Badge tone={STATUS_TONE[provider.status]}>{provider.status}</Badge>
            </p>
            <p className="gp-stat-card__value">{money(provider.balance)}</p>
            <p className="gp-stat-card__hint">
              {provider.status === 'ERROR' ? (
                <RelativeTime iso={provider.lastSuccessAt} prefix="Last success" />
              ) : (
                <RelativeTime iso={provider.checkedAt} prefix="Checked" />
              )}
            </p>
          </div>
        </article>

        <article className="gp-stat-card" data-reveal-item>
          <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--violet" aria-hidden="true">
            <Icon name="users" size={19} />
          </span>
          <div className="gp-stat-card__body">
            <p className="gp-stat-card__label">Allocated to clients</p>
            <p className="gp-stat-card__value">{money(report.clientTotal)}</p>
            <p className="gp-stat-card__hint">Ledger sums to {money(report.ledgerTotal)}</p>
          </div>
        </article>

        <article className="gp-stat-card" data-reveal-item>
          <span
            className={`gp-icon-mark gp-icon-mark--stat ${
              report.consistent ? 'gp-icon-mark--green' : 'gp-icon-mark--rose'
            }`}
            aria-hidden="true"
          >
            <Icon name={report.consistent ? 'check' : 'alert'} size={19} />
          </span>
          <div className="gp-stat-card__body">
            <p className="gp-stat-card__label">Still available</p>
            <p className="gp-stat-card__value">{money(report.available)}</p>
            <p className="gp-stat-card__hint">
              {report.consistent ? 'Consistent' : 'Inconsistency detected'}
            </p>
          </div>
        </article>
      </div>

      <section className="gp-card">
        <header className="gp-card-head">
          <div>
            <p className="gp-card-head__eyebrow">Reconciliation</p>
            <h3 className="gp-card-head__title">
              {report.consistent ? '✅ CONSISTENT' : '⚠️ INCONSISTENCY DETECTED'}
            </h3>
            <p className="gp-card-head__desc">
              Provider {money(provider.balance)} − allocated {money(report.clientTotal)} ={' '}
              <strong>{money(report.available)}</strong> available to allocate.
            </p>
          </div>
          <div className="gp-hero__actions">
            <Button size="sm" loading={busy} onClick={recheck}>
              <Icon name="refresh" size={14} /> Verify now
            </Button>
          </div>
        </header>

        {report.issues.length === 0 ? (
          <div className="gp-empty">
            <span className="gp-empty__icon">
              <Icon name="check" size={22} />
            </span>
            <p style={{ margin: 0 }}>No discrepancy found.</p>
          </div>
        ) : (
          <div style={{ padding: '0 var(--sv-space-5) var(--sv-space-5)' }}>
            {report.issues.map((issue) => (
              <p
                key={issue.code}
                className="tm-alert"
                style={{
                  margin: '0 0 10px',
                  background: issue.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${issue.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
                  color: issue.severity === 'critical' ? '#991b1b' : '#92400e',
                }}
              >
                <strong>{issue.code}</strong> — {issue.detail}
              </p>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
