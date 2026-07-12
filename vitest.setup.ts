// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, …)
// and auto-unmounts rendered components between tests. Loaded via vitest.config.ts
// setupFiles; harmless for node-environment tests that don't touch the DOM.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Polyfills for Base UI primitives (dialog/tooltip) that jsdom lacks. Only patched
// when a DOM exists, so node-environment tests are untouched.
if (typeof window !== "undefined") {
	if (!window.matchMedia) {
		window.matchMedia = vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
	}
	if (!("ResizeObserver" in window)) {
		window.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
	}
	// Base UI checks pointer-capture APIs that jsdom doesn't implement.
	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = () => false;
		Element.prototype.setPointerCapture = () => {};
		Element.prototype.releasePointerCapture = () => {};
	}
	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}
}

afterEach(() => {
	// Node-environment tests have no DOM to tear down; skip cleanup there.
	if (typeof document !== "undefined") cleanup();
});
