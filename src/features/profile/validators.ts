import { z } from "zod";

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
	})
	.refine((values) => values.currentPassword !== values.newPassword, {
		message: "New password must be different from the current one",
		path: ["newPassword"],
	});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
