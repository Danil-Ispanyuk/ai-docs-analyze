// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourceChips } from "../components/SourceChips";
import type { Source } from "@/features/chat/types";

vi.mock("@/shared/config/i18n", () => ({
	useT: () => (key: string, vars?: Record<string, unknown>) => {
		if (key === "workspace.sourcePage") return `p.${vars?.page}`;
		if (key === "workspace.morePages") return `+${vars?.count}`;
		if (key === "workspace.morePagesLabel") return "more pages";
		return key;
	},
}));

const sources: Source[] = [
	{ documentId: "d1", name: "Policy.pdf", page: 1 },
	{ documentId: "d1", name: "Policy.pdf", page: 2 },
	{ documentId: "d2", name: "Handbook.pdf", page: 5 },
];

describe("SourceChips", () => {
	it("groups pages of the same document into one primary chip", () => {
		render(<SourceChips sources={sources} onSelect={() => {}} />);
		expect(screen.getByRole("button", { name: /Policy\.pdf · p\.1/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Handbook\.pdf · p\.5/ })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Policy\.pdf · p\.2/ })).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "more pages" })).toHaveTextContent("+1");
	});

	it("fires onSelect with the primary page when a chip is clicked", async () => {
		const onSelect = vi.fn();
		render(<SourceChips sources={sources} onSelect={onSelect} />);

		await userEvent.click(screen.getByRole("button", { name: /Policy\.pdf · p\.1/ }));
		expect(onSelect).toHaveBeenCalledWith("d1", 1);
	});

	it("opens the picker, selects an extra page, and closes", async () => {
		const onSelect = vi.fn();
		render(<SourceChips sources={sources} onSelect={onSelect} />);

		const moreButton = screen.getByRole("button", { name: "more pages" });
		expect(moreButton).toHaveAttribute("aria-expanded", "false");

		await userEvent.click(moreButton);
		expect(moreButton).toHaveAttribute("aria-expanded", "true");

		const extraPage = screen.getByRole("button", { name: "p.2" });
		await userEvent.click(extraPage);

		expect(onSelect).toHaveBeenCalledWith("d1", 2);
		expect(screen.getByRole("button", { name: "more pages" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});

	it("closes the open picker on an outside click", async () => {
		render(
			<div>
				<button type="button">outside</button>
				<SourceChips sources={sources} onSelect={() => {}} />
			</div>,
		);

		await userEvent.click(screen.getByRole("button", { name: "more pages" }));
		expect(screen.getByRole("button", { name: "p.2" })).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "outside" }));
		expect(screen.queryByRole("button", { name: "p.2" })).not.toBeInTheDocument();
	});

	it("renders no picker button for a single-page document", () => {
		render(
			<SourceChips
				sources={[{ documentId: "d3", name: "Solo.pdf", page: 7 }]}
				onSelect={() => {}}
			/>,
		);
		expect(screen.getByRole("button", { name: /Solo\.pdf · p\.7/ })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "more pages" })).not.toBeInTheDocument();
	});
});
