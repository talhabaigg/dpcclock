import { cn } from '@/lib/utils';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

const STEP_LABELS = ['Login', 'Navigate', 'Filter', 'Select', 'Actions', 'Send'];

interface AgentStepProgressProps {
    currentStep: number;
    totalSteps: number;
    status: 'processing' | 'completed' | 'failed';
    completedSteps: Set<number>;
    selectedStep: number | null;
    onStepClick: (step: number) => void;
}

export default function AgentStepProgress({
    currentStep,
    totalSteps,
    status,
    completedSteps,
    selectedStep,
    onStepClick,
}: AgentStepProgressProps) {
    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';

    const progressPercent = isCompleted
        ? 100
        : totalSteps > 0
          ? Math.min(((currentStep - (isFailed ? 0 : 0.5)) / totalSteps) * 100, 100)
          : 0;

    const barColor = isFailed
        ? 'bg-red-500'
        : isCompleted
          ? 'bg-emerald-500'
          : 'bg-blue-500';

    return (
        <div className="bg-slate-900 px-4 py-3">
            {/* Progress bar */}
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-slate-700/50">
                <div
                    className={cn('h-full rounded-full transition-all duration-700 ease-out', barColor)}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Step dots */}
            <div className="relative flex items-center justify-between">
                {/* Connecting line */}
                <div className="absolute top-[13px] right-3 left-3 h-px bg-slate-700 sm:top-[15px]" />

                {Array.from({ length: totalSteps }, (_, i) => {
                    const stepNum = i + 1;
                    const isDone = completedSteps.has(stepNum) || (isCompleted && stepNum <= totalSteps);
                    const isCurrent = stepNum === currentStep && !isCompleted;
                    const isFutureStep = !isDone && !isCurrent;
                    const isSelected = selectedStep === stepNum;
                    const isClickable = isDone || isCurrent;
                    const label = STEP_LABELS[i] || `Step ${stepNum}`;

                    return (
                        <button
                            key={stepNum}
                            onClick={() => isClickable && onStepClick(stepNum)}
                            disabled={!isClickable}
                            className={cn(
                                'relative z-10 flex flex-col items-center gap-1',
                                isClickable ? 'cursor-pointer' : 'cursor-default',
                            )}
                            title={label}
                        >
                            <div
                                className={cn(
                                    'flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-all sm:h-[30px] sm:w-[30px]',
                                    isDone && 'border-emerald-500 bg-emerald-500/20',
                                    isCurrent && !isFailed && 'animate-pulse border-blue-400 bg-blue-500/20',
                                    isCurrent && isFailed && 'border-red-400 bg-red-500/20',
                                    isFutureStep && 'border-slate-600 bg-slate-800',
                                    isSelected && 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900',
                                )}
                            >
                                {isDone && <Check className="h-3 w-3 text-emerald-400 sm:h-3.5 sm:w-3.5" />}
                                {isCurrent && !isFailed && (
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-400 sm:h-3.5 sm:w-3.5" />
                                )}
                                {isCurrent && isFailed && (
                                    <AlertCircle className="h-3 w-3 text-red-400 sm:h-3.5 sm:w-3.5" />
                                )}
                                {isFutureStep && (
                                    <span className="text-[9px] font-medium text-slate-500 sm:text-[10px]">{stepNum}</span>
                                )}
                            </div>
                            <span
                                className={cn(
                                    'hidden text-[10px] font-medium sm:block',
                                    isDone && 'text-emerald-400/70',
                                    isCurrent && !isFailed && 'text-blue-400',
                                    isCurrent && isFailed && 'text-red-400',
                                    isFutureStep && 'text-slate-600',
                                )}
                            >
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
