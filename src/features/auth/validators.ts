import { z } from "zod";

// Validation for the auth forms. Used inside the server actions so the same
// rules guard the request even if the client is bypassed.
// NOTE: these messages are plain strings. When a second locale is added,
// localize them via getTranslations() inside the server action instead.
export const signInSchema = z.object({
	email: z.string().trim().email("Enter a valid email"),
	password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
	fullName: z.string().trim().min(1, "Enter your name"),
	email: z.string().trim().email("Enter a valid email"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

// Password recovery: request a link by email, then set a new password. The new
// password reuses signUpSchema's rule so both flows enforce the same strength.
export const forgotPasswordSchema = z.object({
	email: z.string().trim().email("Enter a valid email"),
});

export const resetPasswordSchema = signUpSchema.pick({ password: true });

// Guest → account conversion: a guest adds an email + password to their existing
// (anonymous) session. Same email/password rules as sign-up, minus the name.
export const convertAccountSchema = signUpSchema.pick({ email: true, password: true });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ConvertAccountInput = z.infer<typeof convertAccountSchema>;
