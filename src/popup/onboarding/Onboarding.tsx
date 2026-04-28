import { useState } from 'react';
import { ConnectStep } from './ConnectStep';
import { MultiSessionStep } from './MultiSessionStep';
import type { SsoConfig } from '@/shared/types';

type Props = {
  initialSsoConfig?: SsoConfig;
  startStep?: number;
  onComplete: () => void;
};

export function Onboarding({ initialSsoConfig, startStep = 0, onComplete }: Props) {
  const [step, setStep] = useState(startStep);

  if (step === 0) {
    return (
      <ConnectStep
        initialUrl={initialSsoConfig?.startUrl ?? ''}
        onContinue={() => setStep(1)}
      />
    );
  }

  if (step === 1) {
    return (
      <MultiSessionStep
        onBack={() => setStep(0)}
        onContinue={onComplete}
      />
    );
  }

  return null;
}
