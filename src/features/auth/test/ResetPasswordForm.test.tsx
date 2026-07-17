// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";

const actions = vi.hoisted(() => ({ resetPassword: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ resetPassword: actions.resetPassword }));

import { ResetPasswordForm } from "../components/ResetPasswordForm";

const submit = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;

describe("ResetPasswordForm", () => {
	beforeEach(() => {
		actions.resetPassword.mockReset();
		actions.resetPassword.mockResolvedValue(undefined);
	});

	it("enforces the minimum password length", async () => {
		renderWithIntl(<ResetPasswordForm />);
		await userEvent.type(document.querySelector('input[type="password"]')!, "short");
		await userEvent.click(submit());

		expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
		expect(actions.resetPassword).not.toHaveBeenCalled();
	});

	it("calls resetPassword with the new password on a valid submit", async () => {
		renderWithIntl(<ResetPasswordForm />);
		await userEvent.type(document.querySelector('input[type="password"]')!, "brandnewpass");
		await userEvent.click(submit());

		await waitFor(() =>
			expect(actions.resetPassword).toHaveBeenCalledWith({ password: "brandnewpass" }),
		);
	});

	it("shows a root error when the action fails", async () => {
		actions.resetPassword.mockResolvedValue({ error: "Link is no longer valid" });
		renderWithIntl(<ResetPasswordForm />);
		await userEvent.type(document.querySelector('input[type="password"]')!, "brandnewpass");
		await userEvent.click(submit());

		expect(await screen.findByRole("alert")).toHaveTextContent("Link is no longer valid");
	});
});
