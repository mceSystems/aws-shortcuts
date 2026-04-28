import { useState } from 'react';
import { ConnectStep } from './ConnectStep';
import type { SsoConfig } from '@/shared/types';

type Props = {
  initialSsoConfig?: SsoConfig;
  onComplete: () => void;
};

export function Onboarding({ initialSsoConfig, onComplete }: Props) {
  const [step] = useState(0);

  if (step === 0) {
    return (
      <ConnectStep
        initialUrl={initialSsoConfig?.startUrl ?? ''}
        onContinue={onComplete}
      />
    );
  }

  return null;
}
