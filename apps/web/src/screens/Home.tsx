import { useState, type FormEvent } from 'react';
import { useGame } from '../game';
import { Page } from '../components/ui';

const NAME_KEY = 'esm-famil.name';

export function Home() {
  const { create, join } = useGame();
  const params = new URLSearchParams(window.location.search);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [code, setCode] = useState(params.get('room') ?? '');
  const [busy, setBusy] = useState(false);

  const remember = () => localStorage.setItem(NAME_KEY, name.trim());

  const onCreate = async () => {
    setBusy(true);
    remember();
    await create(name);
    setBusy(false);
  };
  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    remember();
    await join(code, name);
    setBusy(false);
  };

  return (
    <Page>
      <header className="mt-10 mb-4">
        <h1 className="text-5xl font-black leading-tight">اسم فامیل</h1>
        <p className="text-ink-soft mt-2 text-lg">
          همان بازی روی کاغذ، این بار با دوستان از راه دور. یک نفر اتاق می‌سازد، بقیه با کد می‌آیند.
        </p>
      </header>

      <form onSubmit={onJoin} className="sheet flex flex-col gap-6 p-5">
        <label className="block">
          <span className="text-ink-soft text-sm">اسم شما در بازی</span>
          <input
            className="field text-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoComplete="nickname"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            className="btn btn-marker text-lg"
            disabled={busy || !name.trim()}
            onClick={onCreate}
          >
            اتاق جدید بساز
          </button>
          <div className="flex items-end gap-2">
            <label className="block grow">
              <span className="text-ink-soft text-sm">کد اتاق</span>
              <input
                className="field text-center font-mono text-lg tracking-[0.3em] uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={4}
                dir="ltr"
                placeholder="ABCD"
              />
            </label>
            <button
              type="submit"
              className="btn"
              disabled={busy || !name.trim() || code.trim().length !== 4}
            >
              بپیوند
            </button>
          </div>
        </div>
      </form>

      <section className="text-ink-soft mt-auto text-sm leading-7">
        <p>
          یک حرف انتخاب می‌شود؛ برای هر دسته کلمه‌ای بنویسید که با آن حرف شروع شود. هر کس زودتر همه
          را پر کند «استپ» می‌زند. جواب درست و تکراری ۵ امتیاز، جواب درستی که فقط شما نوشته‌اید ۱۰
          امتیاز، و اگر تنها کسی باشید که آن ستون را پر کرده ۲۰ امتیاز. جواب‌ها را خودِ بازی
          راستی‌آزمایی می‌کند.
        </p>
      </section>
    </Page>
  );
}
