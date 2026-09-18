import { Connection, Toast } from './components/ui';
import { useGame } from './game';
import { Final } from './screens/Final';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Review } from './screens/Review';
import { Round } from './screens/Round';

export function App() {
  const { state, resuming } = useGame();
  let screen;
  if (resuming) screen = <p className="text-ink-soft p-8 text-center">در حال بازگشت به اتاق…</p>;
  else if (!state) screen = <Home />;
  else if (state.phase === 'lobby') screen = <Lobby />;
  else if (state.phase === 'review' || (state.phase === 'validating' && state.review))
    screen = <Review />;
  else if (state.phase === 'finished') screen = <Final />;
  else screen = <Round />;
  return (
    <>
      <Connection />
      {screen}
      <Toast />
    </>
  );
}
