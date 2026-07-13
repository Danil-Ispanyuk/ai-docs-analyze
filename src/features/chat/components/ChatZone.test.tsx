// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";
import type { ChatMessage } from "@/features/chat/types";
import type { PlanUsage } from "@/features/billing/service";

// Controllable useChat return; mutate before render to drive each scenario.
const chat = vi.hoisted(() => ({
	messages: [] as ChatMessage[],
	sendMessage: vi.fn(),
	status: "ready" as string,
}));
vi.mock("@ai-sdk/react", () => ({ useChat: () => chat }));
vi.mock("ai", () => ({ DefaultChatTransport: class {} }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

import { ChatZone } from "./ChatZone";

const noUsage: PlanUsage = { tokensUsed: 0, requestsUsed: 0 };

function render(props: Partial<Parameters<typeof ChatZone>[0]> = {}) {
	return renderWithIntl(
		<ChatZone
			documentId={null}
			plan="free"
			usage={noUsage}
			scopeName="All documents"
			onSourceClick={() => {}}
			{...props}
		/>,
	);
}

beforeEach(() => {
	chat.messages = [];
	chat.sendMessage.mockReset();
	chat.status = "ready";
	vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ChatZone", () => {
	it("shows the all-documents empty state and disables send with no input", () => {
		render({ documentId: null });
		expect(screen.getByText(/Searching across all your uploaded documents/)).toBeInTheDocument();
		expect(document.querySelector('button[type="submit"]')).toBeDisabled();
	});

	it("sends the question with the scoped documentId and clears the input", async () => {
		render({ documentId: "doc-1" });
		const input = screen.getByRole("textbox") as HTMLInputElement;

		await userEvent.type(input, "What is the policy?");
		expect(document.querySelector('button[type="submit"]')).toBeEnabled();

		await userEvent.click(document.querySelector('button[type="submit"]')!);

		expect(chat.sendMessage).toHaveBeenCalledWith(
			{ text: "What is the policy?" },
			{ body: { documentIds: ["doc-1"] } },
		);
		expect(input.value).toBe("");
	});

	it("does not send when the input is only whitespace", async () => {
		render();
		await userEvent.type(screen.getByRole("textbox"), "   ");
		// Button stays disabled, so a click can't submit.
		expect(document.querySelector('button[type="submit"]')).toBeDisabled();
		expect(chat.sendMessage).not.toHaveBeenCalled();
	});

	it("renders message bubbles and citation chips for an assistant answer", () => {
		chat.messages = [
			{
				id: "u1",
				role: "user",
				parts: [{ type: "text", text: "Where is the policy?" }],
			},
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "text", text: "It is on page 2." },
					{
						type: "data-sources",
						data: [{ documentId: "doc-1", name: "Policy.pdf", page: 2 }],
					},
				],
			},
		] as unknown as ChatMessage[];

		render({ documentId: "doc-1" });

		expect(screen.getByText("Where is the policy?")).toBeInTheDocument();
		expect(screen.getByText("It is on page 2.")).toBeInTheDocument();
		// SourceChips renders the citation as a button.
		expect(screen.getByRole("button", { name: /Policy\.pdf/ })).toBeInTheDocument();
	});

	it("keeps the message list anchored to the bottom", () => {
		const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
		chat.messages = [
			{
				id: "u1",
				role: "user",
				parts: [{ type: "text", text: "Question" }],
			},
			{
				id: "a1",
				role: "assistant",
				parts: [{ type: "text", text: "Answer" }],
			},
		] as unknown as ChatMessage[];

		render();

		expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
	});

	it("labels the meter 'Questions' on a request-capped plan", () => {
		render({ plan: "guest", usage: { tokensUsed: 0, requestsUsed: 3 } });
		expect(screen.getByText("Questions")).toBeInTheDocument();
		expect(screen.queryByText("Tokens")).not.toBeInTheDocument();
	});

	it("labels the meter 'Tokens' on a token-budget plan", () => {
		render({ plan: "free" });
		expect(screen.getByText("Tokens")).toBeInTheDocument();
	});

	it("disables the input while a response is streaming", () => {
		chat.status = "streaming";
		render();
		expect(screen.getByRole("textbox")).toBeDisabled();
	});
});
