// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";
import { RemoveDocumentModal } from "./RemoveDocument";

function setup(onSubmit = vi.fn()) {
	renderWithIntl(
		<RemoveDocumentModal documentTitle="Report.pdf" onSubmit={onSubmit}>
			<button type="button">trigger</button>
		</RemoveDocumentModal>,
	);
	return { onSubmit };
}

describe("RemoveDocumentModal", () => {
	it("keeps the dialog closed until the trigger is clicked", () => {
		setup();
		expect(screen.queryByText("Delete File")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "trigger" })).toBeInTheDocument();
	});

	it("opens the dialog with the document name interpolated", async () => {
		setup();
		await userEvent.click(screen.getByRole("button", { name: "trigger" }));

		expect(await screen.findByText("Delete File")).toBeInTheDocument();
		expect(
			screen.getByText('Are you sure that you want to remove "Report.pdf"?'),
		).toBeInTheDocument();
	});

	it("fires onSubmit when the confirm button is clicked", async () => {
		const { onSubmit } = setup();
		await userEvent.click(screen.getByRole("button", { name: "trigger" }));
		await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
	});
});
