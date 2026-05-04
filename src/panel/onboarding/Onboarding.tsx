import { useState } from 'react';
import { ConnectStep } from './ConnectStep';
import { MultiSessionStep } from './MultiSessionStep';
import { ScanStep } from './ScanStep';
import type { SsoConfig } from '@/shared/types';

type Props = {
  initialSsoConfig?: SsoConfig;
  startStep?: number;
  // Skip the "Enable multi-session" guide. Used by the "Change portal URL"
  // flow from Settings — the user has already completed it once and just
  // wants to point the extension at a different portal.
  skipMultiSession?: boolean;
  onComplete: () => void;
  onCancel?: () => void;
};

export function Onboarding({
  initialSsoConfig,
  startStep,
  skipMultiSession = false,
  onComplete,
  onCancel,
}: Props) {
  // Without skipMultiSession: 3 steps (Multi-session → Connect → Scan).
  // With skipMultiSession: 2 steps (Connect → Scan).
  const totalSteps = skipMultiSession ? 2 : 3;
  const initial = startStep ?? (skipMultiSession ? 1 : 0);
  const [step, setStep] = useState(initial);

  if (!skipMultiSession && step === 0) {
    return <MultiSessionStep onContinue={() => setStep(1)} />;
  }

  if (step === 1) {
    const stepIdx = skipMultiSession ? 0 : 1;
    return (
      <ConnectStep
        initialUrl={initialSsoConfig?.startUrl ?? ''}
        stepIndex={stepIdx}
        totalSteps={totalSteps}
        onBack={skipMultiSession ? (onCancel ?? (() => {})) : () => setStep(0)}
        onContinue={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    const stepIdx = skipMultiSession ? 1 : 2;
    return (
      <ScanStep
        stepIndex={stepIdx}
        totalSteps={totalSteps}
        onBack={() => setStep(1)}
        onComplete={onComplete}
      />
    );
  }

  return null;
}
