'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, Icon } from '@/design-system';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; balance: number; currency: string; checkedAt: string };

/**
 * Solde du compte fournisseur. Chargé côté client pour ne pas ralentir
 * l'affichage du tableau de bord si l'API fournisseur est lente.
 */
export default function ProviderBalanceCard({ autoSubmit }: { autoSubmit: boolean }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const response = await fetch('/api/admin/provider-balance');
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setState({ status: 'error', message: result.error ?? 'Provider unavailable' });
      return;
    }

    setState({
      status: 'ready',
      balance: result.balance,
      currency: result.currency,
      checkedAt: result.checkedAt,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empty = state.status === 'ready' && state.balance <= 0;

  return (
    <Card>
      <CardHeader
        title="Provider balance"
        subtitle="SMMGen account — funds available to execute orders"
        action={
          <Button variant="ghost" size="sm" iconOnly onClick={load} aria-label="Refresh">
            <Icon name="refresh" size={16} />
          </Button>
        }
      />
      <CardBody>
        {state.status === 'loading' && <p className="sv-caption">Checking…</p>}

        {state.status === 'error' && (
          <div className="sv-alert sv-alert--error">
            <span className="sv-alert__icon">
              <Icon name="alert" size={18} />
            </span>
            <p className="sv-alert__body">{state.message}</p>
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <div className="sv-stat__value" style={{ color: empty ? 'var(--sv-error)' : undefined }}>
              {state.balance.toFixed(2)} {state.currency}
            </div>
            <div className="sv-stat__foot">
              <span className="sv-caption">
                Checked {new Date(state.checkedAt).toLocaleTimeString('en-GB')}
              </span>
              {autoSubmit ? (
                <Badge tone="success">Auto-submit ON</Badge>
              ) : (
                <Badge tone="warning">Auto-submit OFF</Badge>
              )}
            </div>

            {empty && autoSubmit && (
              <div className="sv-alert sv-alert--error" style={{ marginTop: 'var(--sv-space-4)' }}>
                <span className="sv-alert__icon">
                  <Icon name="alert" size={18} />
                </span>
                <div>
                  <p className="sv-alert__title">Orders will fail</p>
                  <p className="sv-alert__body">
                    Auto-submit is on but the provider balance is empty: every order will be
                    rejected with “Not enough funds on balance”.
                  </p>
                </div>
              </div>
            )}

            {empty && !autoSubmit && (
              <p className="sv-caption" style={{ marginTop: 'var(--sv-space-3)' }}>
                Top up your SMMGen account before enabling <code>SMM_AUTO_SUBMIT</code>.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
