import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = {
	id: string;
	title: string;
	description?: string;
};

export type StepperProps = {
	steps: Step[];
	currentStepId: string;
	className?: string;
	onStepClick?: (id: string) => void;
};

export function Stepper({ steps, currentStepId, className, onStepClick }: StepperProps) {
	return (
		<ol className={cn("grid gap-2 sm:grid-cols-3", className)}>
			{steps.map((step, index) => {
				const isActive = step.id === currentStepId;
				const isComplete = steps.findIndex(s => s.id === currentStepId) > index;
				return (
					<li key={step.id} className="flex items-start gap-3">
						<button
							onClick={() => onStepClick?.(step.id)}
							className={cn(
								"flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
								isComplete ? "border-primary bg-primary text-primary-foreground" : isActive ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground"
							)}
							aria-current={isActive ? "step" : undefined}
							aria-label={`Step ${index + 1}: ${step.title}`}
						>
							{isComplete ? <Check className="h-4 w-4" /> : index + 1}
						</button>
						<div className="space-y-0.5">
							<div className={cn("text-sm font-medium leading-none", isActive ? "text-foreground" : "text-muted-foreground")}>{step.title}</div>
							{step.description ? (
								<p className="text-xs text-muted-foreground">{step.description}</p>
							) : null}
						</div>
					</li>
				);
			})}
		</ol>
	);
}