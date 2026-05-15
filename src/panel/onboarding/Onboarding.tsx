import { useState } from 'react';
import { ConnectStep } from './ConnectStep';
import { MultiSessionStep } from './MultiSessionStep';
import { ScanStep } from './ScanStep';

type Props = {
  initialUrl?: string;
  initialName?: string;
  startStep?: number;
  // Skip the "Enable multi-session" guide. Used when the user already
  // completed it once and is adding an additional Identity Center.
  skipMultiSession?: boolean;
  onComplete: () => void;
  onCancel?: () => void;
};

export function Onboarding({
  initialUrl,
  initialName,
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
  const [identityCenterId, setIdentityCenterId] = useState<string | null>(null);

  if (!skipMultiSession && step === 0) {
    return <MultiSessionStep onContinue={() => setStep(1)} />;
  }

  if (step === 1) {
    const stepIdx = skipMultiSession ? 0 : 1;
    return (
      <ConnectStep
        initialUrl={initialUrl ?? ''}
        initialName={initialName ?? ''}
        stepIndex={stepIdx}
        totalSteps={totalSteps}
        onBack={
          skipMultiSession
            ? (onCancel ?? (() => setStep(1)))
            : () => setStep(0)
        }
        onContinue={(idcId) => {
          setIdentityCenterId(idcId);
          setStep(2);
        }}
      />
    );
  }

  if (step === 2 && identityCenterId) {
    const stepIdx = skipMultiSession ? 1 : 2;
    return (
      <ScanStep
        identityCenterId={identityCenterId}
        stepIndex={stepIdx}
        totalSteps={totalSteps}
        onBack={() => setStep(1)}
        onComplete={onComplete}
      />
    );
  }

  return null;
}
