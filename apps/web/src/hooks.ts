import { useEffect, useState } from 'react';

/** Wall-clock ticker for countdowns; re-renders every 250ms while `active`. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
