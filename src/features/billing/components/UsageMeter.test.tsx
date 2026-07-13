// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsageMeter } from "./UsageMeter";

function getBar(container: HTMLElement): HTMLElement {
	const bar = container.querySelector<HTMLElement>("[style*='width']");
	if (!bar) throw new Error("meter bar not found");
	return bar;
}

describe("UsageMeter", () => {
	it("renders the label and value", () => {
		render(<UsageMeter label="Tokens" valueLabel="10k / 50k" percent={20} />);
		expect(screen.getByText("Tokens")).toBeInTheDocument();
		expect(screen.getByText("10k / 50k")).toBeInTheDocument();
	});

	it("uses the primary color below 90%", () => {
		const { container } = render(<UsageMeter label="l" valueLabel="v" percent={50} />);
		const bar = getBar(container);
		expect(bar).toHaveClass("bg-primary");
		expect(bar.style.width).toBe("50%");
	});

	it("switches to amber in the 90–99% warning band", () => {
		const { container } = render(<UsageMeter label="l" valueLabel="v" percent={95} />);
		expect(getBar(container)).toHaveClass("bg-amber-500");
	});

	it("switches to destructive at 100% and above", () => {
		const { container } = render(<UsageMeter label="l" valueLabel="v" percent={100} />);
		expect(getBar(container)).toHaveClass("bg-destructive");
	});

	it("clamps the bar width to the 0–100% range", () => {
		const over = render(<UsageMeter label="l" valueLabel="v" percent={140} />);
		expect(getBar(over.container).style.width).toBe("100%");

		const under = render(<UsageMeter label="l" valueLabel="v" percent={-20} />);
		expect(getBar(under.container).style.width).toBe("0%");
	});

	it("shows the hint only when provided", () => {
		const { rerender } = render(<UsageMeter label="l" valueLabel="v" percent={10} />);
		expect(screen.queryByText("Almost full")).not.toBeInTheDocument();

		rerender(<UsageMeter label="l" valueLabel="v" percent={10} hint="Almost full" />);
		expect(screen.getByText("Almost full")).toBeInTheDocument();
	});
});
