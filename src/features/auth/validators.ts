import { z } from "zod";

export const signInSchema = z.object({
	email: z.string().trim().email("Enter a valid email"),
	password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
	fullName: z.string().trim().min(1, "Enter your name"),
	email: z.string().trim().email("Enter a valid email"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
	email: z.string().trim().email("Enter a valid email"),
});

export const resetPasswordSchema = signUpSchema.pick({ password: true });

export const convertAccountSchema = signUpSchema.pick({
	fullName: true,
	email: true,
	password: true,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ConvertAccountInput = z.infer<typeof convertAccountSchema>;
