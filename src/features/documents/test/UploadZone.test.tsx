// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";
import type { DocumentRow } from "@/features/documents/service";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
const uploadSpy = vi.hoisted(() => vi.fn());
const actions = vi.hoisted(() => ({
	createDocument: vi.fn(),
	ingestDocument: vi.fn(),
	removeDocument: vi.fn(),
}));
const toastSpy = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/shared/lib/toast", () => ({ toast: toastSpy }));
vi.mock("@/shared/config/supabase/client", () => ({
	createClient: () => ({ storage: { from: () => ({ upload: uploadSpy }) } }),
}));
vi.mock("@/features/documents/actions", () => ({
	createDocument: actions.createDocument,
	ingestDocument: actions.ingestDocument,
	removeDocument: actions.removeDocument,
}));
vi.mock("@/features/folders/actions", () => ({
	createFolder: vi.fn(),
	renameFolder: vi.fn(),
	deleteFolder: vi.fn(),
	moveDocumentToFolder: vi.fn(),
}));

import { UploadZone } from "../components/UploadZone";

function makeDoc(overrides: Partial<DocumentRow> = {}): DocumentRow {
	return {
		id: "doc-1",
		name: "Handbook.pdf",
		status: "ready",
		created_at: "2026-01-01",
		size: 1000,
		folder_id: null,
		...overrides,
	};
}

function render(props: Partial<Parameters<typeof UploadZone>[0]> = {}) {
	const onSelectDocument = props.onSelectDocument ?? vi.fn();
	const onSelectAll = props.onSelectAll ?? vi.fn();
	renderWithIntl(
		<UploadZone
			userId="user-1"
			plan="pro"
			documents={[]}
			folders={[]}
			scope={{ documentId: null, folderId: null }}
			onSelectAll={onSelectAll}
			onSelectDocument={onSelectDocument}
			onSelectFolder={vi.fn()}
			{...props}
		/>,
	);
	return { onSelectDocument, onSelectAll };
}

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const pdf = (name = "doc.pdf", bytes = 10) =>
	new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

beforeEach(() => {
	router.refresh.mockReset();
	uploadSpy.mockReset();
	actions.createDocument.mockReset();
	actions.ingestDocument.mockReset();
	actions.removeDocument.mockReset();
	toastSpy.success.mockReset();
	toastSpy.error.mockReset();
	uploadSpy.mockResolvedValue({ error: null });
	actions.createDocument.mockResolvedValue({ documentId: "doc-1" });
	actions.ingestDocument.mockResolvedValue({});
	actions.removeDocument.mockResolvedValue({});
});

describe("UploadZone", () => {
	it("shows the empty state when there are no documents", () => {
		render();
		expect(screen.getByText("No documents yet")).toBeInTheDocument();
	});

	it("rejects a non-PDF file without uploading", async () => {
		render();
		await userEvent.upload(fileInput(), new File(["x"], "note.txt", { type: "text/plain" }), {
			applyAccept: false,
		});

		expect(toastSpy.error).toHaveBeenCalledWith("Only PDF files are supported.");
		expect(uploadSpy).not.toHaveBeenCalled();
		expect(actions.createDocument).not.toHaveBeenCalled();
	});

	it("rejects a PDF larger than the plan's file-size limit", async () => {
		render({ plan: "guest" });
		await userEvent.upload(fileInput(), pdf("big.pdf", 1024 * 1024 + 1));

		expect(toastSpy.error).toHaveBeenCalledWith("File is too large (max 1 MB).");
		expect(uploadSpy).not.toHaveBeenCalled();
	});

	it("uploads a valid PDF, creates the row, and kicks off ingestion", async () => {
		render();
		await userEvent.upload(fileInput(), pdf("policy.pdf"));

		await waitFor(() => expect(actions.createDocument).toHaveBeenCalled());
		expect(uploadSpy).toHaveBeenCalledTimes(1);
		const createArg = actions.createDocument.mock.calls[0][0];
		expect(createArg.name).toBe("policy.pdf");
		expect(createArg.storagePath).toMatch(/^user-1\/.+\.pdf$/);

		await waitFor(() => expect(actions.ingestDocument).toHaveBeenCalledWith("doc-1"));
		expect(toastSpy.success).toHaveBeenCalled();
		expect(router.refresh).toHaveBeenCalled();
	});

	it("selects a document when its row is clicked", async () => {
		const { onSelectDocument, onSelectAll } = render({
			documents: [makeDoc({ name: "Doc One.pdf" })],
		});

		await userEvent.click(screen.getByText("Doc One.pdf"));
		expect(onSelectDocument).toHaveBeenCalledWith("doc-1");

		await userEvent.click(screen.getByText("All documents"));
		expect(onSelectAll).toHaveBeenCalled();
	});

	it("offers a retry that re-ingests a failed document", async () => {
		render({ documents: [makeDoc({ id: "bad", status: "error" })] });

		expect(screen.getByText("Failed")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Retry indexing" }));
		await waitFor(() => expect(actions.ingestDocument).toHaveBeenCalledWith("bad"));
	});

	it("blocks uploads and shows the limit notice when the file cap is reached", () => {
		render({ plan: "guest", documents: [makeDoc()] });
		expect(screen.getByText("File limit reached on your plan.")).toBeInTheDocument();
		expect(fileInput()).toBeDisabled();
	});
});
