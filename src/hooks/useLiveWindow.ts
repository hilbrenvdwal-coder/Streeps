import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * useLiveWindow — Houdt een "now" epoch-ms timestamp bij die elke `intervalMs`
 * milliseconden (default 30s) wordt bijgewerkt, én direct bij AppState-resume
 * ('active'). Gebruik dit om componenten te re-renderen wanneer relatieve
 * tijdlabels (bijv. "Vandaag, avond") stale kunnen worden.
 *
 * @param intervalMs  Poll-interval in ms (default 30000)
 * @returns           Huidige epoch ms (Date.now()), steeds bijgewerkt
 */
export function useLiveWindow(intervalMs = 30_000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());

    const interval = setInterval(tick, intervalMs);

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          tick();
        }
      },
    );

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
