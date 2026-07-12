export const DOCUMENTS_BUCKET = "documents";

// File-size limits are plan-dependent now — see getPlanLimits() in src/lib/billing.ts.

export type DocumentRow = {
	id: string;
	name: string;
	status: string;
	created_at: string;
	size: number;
};
