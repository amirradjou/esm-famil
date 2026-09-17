import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useGame } from '../game';

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh flex-col gap-6 px-4 py-6 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}
    >
      {children}
    </main>
  );
}

export function Letter({ letter, animate = false }: { letter: string; animate?: boolean }) {
  return (
    <span className={`stamp ${animate ? 'stamp-in' : ''}`} aria-label={`حرف ${letter}`}>
      {letter}
    </span>
  );
}

export function Toast() {
  const { error, clearError } = useGame();
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 4000);
    return () => clearTimeout(id);
  }, [error, clearError]);
  if (!error) return null;
  return (
    <div
      role="alert"
      className="bg-pen fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[6px] px-4 py-3 font-medium text-white shadow-lg"
    >
      {error.message}
    </div>
  );
}

export function Connection() {
  const { connected } = useGame();
  if (connected) return null;
  return (
    <div className="bg-ink text-paper fixed top-0 inset-x-0 z-50 py-1 text-center text-sm">
      در حال اتصال دوباره…
    </div>
  );
}
