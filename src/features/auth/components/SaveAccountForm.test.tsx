// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";

const actions = vi.hoisted(() => ({ convertGuestAccount: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({
	convertGuestAccount: actions.convertGuestAccount,
}));

import { SaveAccountForm } from "./SaveAccountForm";

const submit = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;
const fill = async () => {
	await userEvent.type(document.querySelector('input[type="email"]')!, "guest@example.com");
	await userEvent.type(document.querySelector('input[type="password"]')!, "supersecret");
};

describe("SaveAccountForm", () => {
	beforeEach(() => {
		actions.convertGuestAccount.mockReset();
		actions.convertGuestAccount.mockResolvedValue(undefined);
	});

	it("calls convertGuestAccount with email + password", async () => {
		renderWithIntl(<SaveAccountForm />);
		await fill();
		await userEvent.click(submit());

		await waitFor(() =>
			expect(actions.convertGuestAccount).toHaveBeenCalledWith({
				email: "guest@example.com",
				password: "supersecret",
			}),
		);
	});

	it("swaps the form for a confirmation message on success", async () => {
		actions.convertGuestAccount.mockResolvedValue({ message: "Account saved — confirm email." });
		renderWithIntl(<SaveAccountForm />);
		await fill();
		await userEvent.click(submit());

		expect(await screen.findByText("Account saved — confirm email.")).toBeInTheDocument();
		expect(document.querySelector('button[type="submit"]')).toBeNull();
	});

	it("shows a root error when the action fails", async () => {
		actions.convertGuestAccount.mockResolvedValue({ error: "Email already in use" });
		renderWithIntl(<SaveAccountForm />);
		await fill();
		await userEvent.click(submit());

		expect(await screen.findByRole("alert")).toHaveTextContent("Email already in use");
	});
});
