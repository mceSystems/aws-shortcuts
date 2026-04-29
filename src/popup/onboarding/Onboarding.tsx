import { useState } from 'react';
import { ConnectStep } from './ConnectStep';
import { MultiSessionStep } from './MultiSessionStep';
import { ScanStep } from './ScanStep';
import type { SsoConfig } from '@/shared/types';

type Props = {
  initialSsoConfig?: SsoConfig;
  startStep?: number;
  onComplete: () => void;
};

export function Onboarding({ initialSsoConfig, startStep = 0, onComplete }: Props) {
  const [step, setStep] = useState(startStep);

  if (step === 0) {
    return <MultiSessionStep onContinue={() => setStep(1)} />;
  }

  if (step === 1) {
    return (
      <ConnectStep
        initialUrl={initialSsoConfig?.startUrl ?? ''}
        onContinue={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    return <ScanStep onBack={() => setStep(1)} onComplete={onComplete} />;
  }

  return null;
}
