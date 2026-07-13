// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";
import type { ChatMessage } from "@/features/chat/types";
import type { PlanUsage } from "@/features/billing/service";

const chat = vi.hoisted(() => ({
	messages: [] as ChatMessage[],
	sendMessage: vi.fn(),
	setMessages: vi.fn(),
	status: "ready" as string,
}));
vi.mock("@ai-sdk/react", () => ({ useChat: () => chat }));
vi.mock("ai", () => ({ DefaultChatTransport: class {} }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/features/chat/actions", () => ({ getChatMessages: vi.fn(() => Promise.resolve([])) }));

import { ChatZone } from "./ChatZone";

const noUsage: PlanUsage = { tokensUsed: 0, requestsUsed: 0 };

function render(props: Partial<Parameters<typeof ChatZone>[0]> = {}) {
	return renderWithIntl(
		<ChatZone
			scope={{ documentId: null, folderId: null }}
			plan="free"
			usage={noUsage}
			scopeName="All documents"
			initialMessages={[]}
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
		render({ scope: { documentId: null, folderId: null } });
		expect(screen.getByText(/Searching across all your uploaded documents/)).toBeInTheDocument();
		expect(document.querySelector('button[type="submit"]')).toBeDisabled();
	});

	it("sends the question with the scoped documentId and clears the input", async () => {
		render({ scope: { documentId: "doc-1", folderId: null } });
		const input = screen.getByRole("textbox") as HTMLInputElement;

		await userEvent.type(input, "What is the policy?");
		expect(document.querySelector('button[type="submit"]')).toBeEnabled();

		await userEvent.click(document.querySelector('button[type="submit"]')!);

		expect(chat.sendMessage).toHaveBeenCalledWith(
			{ text: "What is the policy?" },
			{ body: { documentId: "doc-1", folderId: undefined } },
		);
		expect(input.value).toBe("");
	});

	it("does not send when the input is only whitespace", async () => {
		render();
		await userEvent.type(screen.getByRole("textbox"), "   ");
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

		render({ scope: { documentId: "doc-1", folderId: null } });

		expect(screen.getByText("Where is the policy?")).toBeInTheDocument();
		expect(screen.getByText("It is on page 2.")).toBeInTheDocument();
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
