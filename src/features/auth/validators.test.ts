import { describe, it, expect } from "vitest";
import {
	signInSchema,
	signUpSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	convertAccountSchema,
} from "./validators";

describe("signInSchema", () => {
	it("accepts a valid email + non-empty password", () => {
		const result = signInSchema.safeParse({ email: "user@example.com", password: "x" });
		expect(result.success).toBe(true);
	});

	it("trims the email before validating", () => {
		const result = signInSchema.safeParse({ email: "  user@example.com  ", password: "x" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.email).toBe("user@example.com");
	});

	it("rejects an invalid email", () => {
		const result = signInSchema.safeParse({ email: "not-an-email", password: "x" });
		expect(result.success).toBe(false);
	});

	it("rejects an empty password", () => {
		const result = signInSchema.safeParse({ email: "user@example.com", password: "" });
		expect(result.success).toBe(false);
	});
});

describe("signUpSchema", () => {
	const valid = { fullName: "Ada Lovelace", email: "ada@example.com", password: "12345678" };

	it("accepts a full name, valid email and 8+ char password", () => {
		expect(signUpSchema.safeParse(valid).success).toBe(true);
	});

	it("rejects a password shorter than 8 characters", () => {
		expect(signUpSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
	});

	it("rejects a blank name (after trim)", () => {
		expect(signUpSchema.safeParse({ ...valid, fullName: "   " }).success).toBe(false);
	});
});

describe("forgotPasswordSchema", () => {
	it("accepts a valid email", () => {
		expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
	});

	it("rejects an invalid email", () => {
		expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
	});
});

describe("resetPasswordSchema", () => {
	it("enforces the sign-up password rule and ignores other fields", () => {
		expect(resetPasswordSchema.safeParse({ password: "12345678" }).success).toBe(true);
		expect(resetPasswordSchema.safeParse({ password: "short" }).success).toBe(false);
	});
});

describe("convertAccountSchema", () => {
	it("requires email + 8+ char password but no name", () => {
		expect(
			convertAccountSchema.safeParse({ email: "guest@example.com", password: "12345678" }).success,
		).toBe(true);
		expect(
			convertAccountSchema.safeParse({ email: "guest@example.com", password: "short" }).success,
		).toBe(false);
	});
});
