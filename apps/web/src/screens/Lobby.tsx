import {
  ALL_CATEGORIES,
  PERSIAN_ALPHABET,
  RARE_LETTERS,
  type GameSettings,
} from '@esm-famil/shared';
import { useRef, useState } from 'react';
import { num } from '../format';
import { useGame } from '../game';
import { Page } from '../components/ui';

export function Lobby() {
  const { state, me, isHost, updateSettings, start, leave, kick } = useGame();
  const [copied, setCopied] = useState(false);
  // Quick successive toggles must build on the last patch, not on the last snapshot rendered.
  const latest = useRef<GameSettings | null>(null);
  if (!state || !me) return null;
  const s = state.settings;
  const llm = state.server.llm;
  latest.current = { ...latest.current, ...s };

  const inviteUrl = `${window.location.origin}/?room=${state.id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('این لینک را برای دوستان بفرستید:', inviteUrl);
    }
  };

  const patch = (p: Partial<GameSettings>) => {
    latest.current = { ...(latest.current ?? s), ...p };
    void updateSettings(p);
  };
  const toggle = (key: 'categoryIds' | 'letterPool', id: string) => {
    const list = (latest.current ?? s)[key];
    patch({ [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-ink-soft text-sm">کد اتاق</p>
          <p className="font-mono text-4xl font-black tracking-[0.25em]" dir="ltr">
            {state.id}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-quiet" onClick={copy}>
            {copied ? 'کپی شد' : 'کپی لینک دعوت'}
          </button>
          <button className="btn btn-quiet" onClick={leave}>
            خروج
          </button>
        </div>
      </header>

      <section className="sheet p-5">
        <h2 className="mb-3 text-lg font-bold">بازیکن‌ها ({num(state.players.length)})</h2>
        <ul className="divide-rule divide-y">
          {state.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className={p.connected ? '' : 'text-ink-soft line-through'}>
                {p.name}
                {p.id === state.hostId && <span className="text-pen ms-2 text-sm">میزبان</span>}
                {p.id === me.id && <span className="text-ink-soft ms-2 text-sm">(شما)</span>}
              </span>
              {isHost && p.id !== me.id && (
                <button className="text-ink-soft text-sm hover:text-pen" onClick={() => kick(p.id)}>
                  حذف
                </button>
              )}
            </li>
          ))}
        </ul>
        {state.players.length < 2 && (
          <p className="text-ink-soft mt-3 text-sm">
            لینک دعوت را بفرستید؛ با دو نفر می‌شود شروع کرد.
          </p>
        )}
      </section>

      <section className="sheet flex flex-col gap-6 p-5">
        <h2 className="text-lg font-bold">
          تنظیمات{' '}
          {isHost ? (
            ''
          ) : (
            <span className="text-ink-soft text-sm font-normal">(فقط میزبان تغییر می‌دهد)</span>
          )}
        </h2>

        <fieldset disabled={!isHost} className="flex flex-col gap-2">
          <legend className="text-ink-soft mb-2 text-sm">دسته‌ها</legend>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => {
              const on = s.categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle('categoryIds', c.id)}
                  className={`rounded-[6px] border-[1.5px] px-3 py-1 ${
                    on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-soft'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset disabled={!isHost} className="flex flex-col gap-2">
          <legend className="text-ink-soft mb-2 text-sm">حرف‌ها</legend>
          <div className="flex flex-wrap gap-1.5" dir="rtl">
            {PERSIAN_ALPHABET.map((l) => {
              const on = s.letterPool.includes(l);
              const rare = RARE_LETTERS.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  title={rare ? 'حرف کم‌کاربرد' : undefined}
                  onClick={() => toggle('letterPool', l)}
                  className={`h-9 w-9 rounded-[6px] border-[1.5px] text-lg font-bold ${
                    on ? 'border-pen text-pen' : 'border-rule text-ink-soft opacity-60'
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Num
            label="تعداد دور"
            value={s.totalRounds}
            min={1}
            max={20}
            disabled={!isHost}
            onChange={(v) => patch({ totalRounds: v })}
          />
          <Num
            label="زمان هر دور (ثانیه، ۰ = بدون زمان)"
            value={s.roundSeconds}
            min={0}
            max={600}
            step={15}
            disabled={!isHost}
            onChange={(v) => patch({ roundSeconds: v })}
          />
          <Num
            label="مهلت بعد از استپ (ثانیه)"
            value={s.stopGraceSeconds}
            min={0}
            max={30}
            disabled={!isHost}
            onChange={(v) => patch({ stopGraceSeconds: v })}
          />
        </div>

        <fieldset disabled={!isHost} className="flex flex-col gap-2">
          <legend className="text-ink-soft mb-2 text-sm">راستی‌آزمایی جواب‌ها</legend>
          <Mode
            selected={!s.llmJudge}
            title="فقط پایگاه واژگان"
            hint="هر جواب با فهرست کلمه‌های بازی مقایسه می‌شود. کلمه‌ای که در فهرست نباشد «تشخیص داده نشد» می‌گیرد."
            onSelect={() => patch({ llmJudge: false })}
          />
          <Mode
            selected={s.llmJudge}
            disabled={!llm.available}
            title="پایگاه واژگان + داور هوش مصنوعی"
            hint={
              llm.available
                ? `کلمه‌هایی که در فهرست نیستند را ${llm.model} داوری می‌کند.`
                : 'روی این سرور مدل زبانی تنظیم نشده است.'
            }
            onSelect={() => patch({ llmJudge: true })}
          />
        </fieldset>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={!isHost}
              checked={s.unverifiedPolicy === 'accept'}
              onChange={(e) => patch({ unverifiedPolicy: e.target.checked ? 'accept' : 'reject' })}
            />
            <span>جوابی که تشخیص داده نشد، درست حساب شود (میزبان می‌تواند بعداً تغییرش دهد)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={!isHost}
              checked={s.soloBonus}
              onChange={(e) => patch({ soloBonus: e.target.checked })}
            />
            <span>اگر فقط یک نفر ستونی را درست پر کند ۲۰ امتیاز بگیرد</span>
          </label>
        </div>
      </section>

      {isHost ? (
        <button
          className="btn btn-marker text-xl"
          disabled={state.players.length < 2}
          onClick={start}
        >
          شروع بازی
        </button>
      ) : (
        <p className="text-ink-soft text-center">منتظر میزبان برای شروع…</p>
      )}
    </Page>
  );
}

function Mode(props: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      disabled={props.disabled}
      onClick={props.onSelect}
      className={`flex items-start gap-3 rounded-[6px] border-[1.5px] p-3 text-right transition-colors disabled:opacity-50 ${
        props.selected ? 'border-ink' : 'border-rule'
      }`}
    >
      <span
        aria-hidden
        className={`mt-1 inline-block h-4 w-4 shrink-0 rounded-full border-[1.5px] ${
          props.selected ? 'border-ink bg-ink' : 'border-rule'
        }`}
      />
      <span>
        <span className="block font-bold">{props.title}</span>
        <span className="text-ink-soft block text-sm">{props.hint}</span>
      </span>
    </button>
  );
}

function Num(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-ink-soft text-sm">{props.label}</span>
      <input
        type="number"
        className="field"
        dir="ltr"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}
