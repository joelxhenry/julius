import { useEffect, useState } from 'react';
import { Center, Loader } from '@mantine/core';
import { FirstRunWizard } from './FirstRunWizard';

type GateState = 'checking' | 'setup' | 'ready';

/**
 * Decides, once at startup, whether the first-run wizard should run.
 *
 * While the wizard is active the rest of the app (router, database gate) is not
 * mounted, so setup happens in isolation. Existing installs — which have no
 * `setupCompleted` flag — resolve straight to `ready`.
 */
export function FirstRunGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electron.getSetupState?.();
        if (cancelled) return;
        setState(result?.needsSetup ? 'setup' : 'ready');
      } catch {
        // If we cannot read setup state, fall through to the normal app rather
        // than trapping the user in the wizard.
        if (!cancelled) setState('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <Center mih="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (state === 'setup') {
    return <FirstRunWizard onComplete={() => setState('ready')} />;
  }

  return <>{children}</>;
}
