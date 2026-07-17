import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, getPlanLimits, formatTokens, formatStorage } from "../service";

describe("getPlanLimits", () => {
	it("returns the matching limits for a known plan", () => {
		expect(getPlanLimits("pro")).toBe(PLAN_LIMITS.pro);
		expect(getPlanLimits("free")).toBe(PLAN_LIMITS.free);
		expect(getPlanLimits("guest")).toBe(PLAN_LIMITS.guest);
	});

	it("falls back to the guest plan for null/undefined", () => {
		expect(getPlanLimits(null)).toBe(PLAN_LIMITS.guest);
		expect(getPlanLimits(undefined)).toBe(PLAN_LIMITS.guest);
	});

	it("keeps guest the most restrictive plan (caps set, small file size)", () => {
		expect(PLAN_LIMITS.guest.requestCap).toBe(15);
		expect(PLAN_LIMITS.guest.tokenBudget).toBe(50_000);
		expect(PLAN_LIMITS.guest.maxFiles).toBe(1);
		expect(PLAN_LIMITS.free.requestCap).toBeNull();
		expect(PLAN_LIMITS.pro.maxFiles).toBeNull();
	});
});

describe("formatTokens", () => {
	it("shows raw counts below 1,000", () => {
		expect(formatTokens(0)).toBe("0");
		expect(formatTokens(999)).toBe("999");
	});

	it("rounds thousands to a whole 'k'", () => {
		expect(formatTokens(1_000)).toBe("1k");
		expect(formatTokens(1_500)).toBe("2k");
		expect(formatTokens(50_000)).toBe("50k");
	});

	it("renders millions with a trailing 'M', dropping '.0' for whole values", () => {
		expect(formatTokens(1_000_000)).toBe("1M");
		expect(formatTokens(5_000_000)).toBe("5M");
		expect(formatTokens(1_500_000)).toBe("1.5M");
	});
});

describe("formatStorage", () => {
	it("uses MB below 1 GB", () => {
		expect(formatStorage(1024 * 1024)).toBe("1 MB");
		expect(formatStorage(1.5 * 1024 * 1024)).toBe("1.5 MB");
	});

	it("uses GB at or above 1 GB", () => {
		expect(formatStorage(1024 * 1024 * 1024)).toBe("1 GB");
		expect(formatStorage(15 * 1024 * 1024 * 1024)).toBe("15 GB");
		expect(formatStorage(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
	});

	it("drops decimals once a value reaches double digits", () => {
		expect(formatStorage(12.3 * 1024 * 1024)).toBe("12 MB");
	});
});
