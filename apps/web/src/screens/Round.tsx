import { categoryLabel, startsWithLetter, type Answers } from '@esm-famil/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mmss, num } from '../format';
import { useGame, useNow } from '../game';
import { Letter, Page } from '../components/ui';

export function Round() {
  const { state, me, sendAnswers, stop } = useGame();
  const round = state?.round;
  const [answers, setAnswers] = useState<Answers>({});
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const now = useNow(!!round);

  // Fresh sheet for every round.
  useEffect(() => {
    setAnswers({});
    firstInput.current?.focus();
  }, [round?.number]);

  // Autosave so a stopped round still counts what was typed.
  useEffect(() => {
    const id = setTimeout(() => sendAnswers(answers), 250);
    return () => clearTimeout(id);
  }, [answers, sendAnswers]);

  const categories = state?.settings.categoryIds ?? [];
  const letter = round?.letter ?? '';
  const complete = useMemo(
    () => categories.every((c) => startsWithLetter(answers[c] ?? '', letter)),
    [categories, answers, letter],
  );

  if (!state || !me || !round) return null;

  const stopping = state.phase === 'stopping';
  const validating = state.phase === 'validating';
  const stopper = stopping ? state.players.find((p) => p.id === round.stop?.by) : null;
  const deadline = stopping ? (round.stop?.deadline ?? now) : round.endsAt;
  const remaining = deadline ? deadline - now : null;

  const onStop = async () => {
    if (!complete) {
      setShake(true);
      setTimeout(() => setShake(false), 350);
      return;
    }
    setBusy(true);
    await stop(answers);
    setBusy(false);
  };

  return (
    <Page>
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-ink-soft text-sm">
            دور {num(round.number)} از {num(state.settings.totalRounds)}
          </p>
          <p className="text-3xl font-black">
            {remaining !== null ? (
              <span className={remaining < 10_000 ? 'text-pen' : ''} dir="ltr">
                {mmss(remaining)}
              </span>
            ) : (
              'بدون زمان'
            )}
          </p>
        </div>
        <Letter letter={letter} animate />
      </header>

      {validating ? (
        <section className="sheet p-6 text-center">
          <p className="text-xl font-bold">در حال راستی‌آزمایی جواب‌ها…</p>
          <p className="text-ink-soft mt-1">چند ثانیه صبر کنید.</p>
        </section>
      ) : (
        <>
          {stopping && (
            <p
              role="status"
              className="bg-marker rounded-[6px] px-4 py-2 text-center font-bold text-[#1e2a44]"
            >
              {stopper?.name} استپ زد! {mmss(remaining ?? 0)} وقت دارید.
            </p>
          )}

          <section className={`sheet ${shake ? 'shake' : ''}`}>
            <ul className="divide-rule divide-y">
              {categories.map((cat, i) => {
                const value = answers[cat] ?? '';
                const ok = startsWithLetter(value, letter);
                return (
                  <li key={cat} className="flex items-center gap-3 px-4">
                    <label htmlFor={`cat-${cat}`} className="text-ink-soft w-16 shrink-0 text-sm">
                      {categoryLabel(cat)}
                    </label>
                    <input
                      id={`cat-${cat}`}
                      ref={i === 0 ? firstInput : undefined}
                      className="field text-xl font-medium"
                      style={{ borderBottom: 0 }}
                      value={value}
                      onChange={(e) => setAnswers((a) => ({ ...a, [cat]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const next = document.getElementById(`cat-${categories[i + 1] ?? ''}`);
                        if (next) next.focus();
                        else void onStop();
                      }}
                      maxLength={40}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      enterKeyHint={i === categories.length - 1 ? 'done' : 'next'}
                    />
                    <span
                      className={`w-5 text-center ${ok ? 'text-ok' : 'text-transparent'}`}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <button
            className="btn btn-marker sticky bottom-4 text-2xl font-black"
            disabled={busy || stopping}
            onClick={onStop}
          >
            استپ!
          </button>
          <p className="text-ink-soft -mt-3 text-center text-sm">
            {stopping
              ? 'یکی استپ زده؛ هرچه نوشته‌اید حساب می‌شود.'
              : 'همه‌ی خانه‌ها که با حرف درست پر شد، استپ بزنید.'}
          </p>
        </>
      )}
    </Page>
  );
}
