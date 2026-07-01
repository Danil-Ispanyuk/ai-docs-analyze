export const DOCUMENTS_BUCKET = "documents";

export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export type DocumentRow = {
	id: string;
	name: string;
	status: string;
	created_at: string;
};
