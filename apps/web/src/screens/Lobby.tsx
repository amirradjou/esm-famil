import { useState } from 'react';
import { GameSettingsForm } from '../components/GameSettingsForm';
import { PlayerList } from '../components/PlayerList';
import { Page } from '../components/ui';
import { useGame } from '../game';

export function Lobby() {
  const { state, me, isHost, updateSettings, start, leave, kick } = useGame();
  const [copied, setCopied] = useState(false);
  if (!state || !me) return null;

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

      <PlayerList
        players={state.players}
        hostId={state.hostId}
        meId={me.id}
        onKick={isHost ? (id) => void kick(id) : undefined}
      />

      <GameSettingsForm
        settings={state.settings}
        llm={state.server.llm}
        editable={isHost}
        onPatch={updateSettings}
      />

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
