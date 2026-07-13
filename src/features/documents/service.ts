export const DOCUMENTS_BUCKET = "documents";

export type DocumentRow = {
	id: string;
	name: string;
	status: string;
	created_at: string;
	size: number;
	folder_id: string | null;
};
