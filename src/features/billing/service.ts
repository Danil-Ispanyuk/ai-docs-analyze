import { PLAN_TYPES } from "@/shared/constants/general";

export type Plan = typeof PLAN_TYPES.GUEST | typeof PLAN_TYPES.FREE | typeof PLAN_TYPES.PRO;

export interface PlanLimits {
	maxFileSize: number | null;
	storageLimit: number;
	maxFiles: number | null;
	tokenBudget: number | null;
	requestCap: number | null;
}

export interface PlanUsage {
	tokensUsed: number;
	requestsUsed: number;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
	guest: {
		maxFileSize: 1 * MB,
		storageLimit: 1 * MB,
		maxFiles: 1,
		tokenBudget: 50_000,
		requestCap: 15,
	},
	free: {
		maxFileSize: null,
		storageLimit: 2 * GB,
		maxFiles: null,
		tokenBudget: 150_000,
		requestCap: null,
	},
	pro: {
		maxFileSize: null,
		storageLimit: 15 * GB,
		maxFiles: null,
		tokenBudget: 300_000,
		requestCap: null,
	},
};

const DEFAULT_PLAN: Plan = PLAN_TYPES.GUEST;

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
	return PLAN_LIMITS[(plan ?? DEFAULT_PLAN) as Plan];
}

export function formatTokens(count: number): string {
	if (count >= 1_000_000) {
		const millions = count / 1_000_000;
		return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
	}
	if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
	return `${count}`;
}
export function formatStorage(bytes: number): string {
	const inUnit = (value: number) =>
		Number.isInteger(value) ? `${value}` : value.toFixed(value < 10 ? 1 : 0);
	if (bytes >= GB) return `${inUnit(bytes / GB)} GB`;
	return `${inUnit(bytes / MB)} MB`;
}
