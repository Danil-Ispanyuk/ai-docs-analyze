import { z } from "zod";

export const folderNameSchema = z.object({
	name: z.string().trim().min(1, "Enter a folder name").max(60, "Name is too long"),
});

export type FolderNameInput = z.infer<typeof folderNameSchema>;
