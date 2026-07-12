// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";

const actions = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));
const toastSpy = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({
	requestPasswordReset: actions.requestPasswordReset,
}));
vi.mock("@/shared/lib/toast", () => ({ toast: toastSpy }));

import { ForgotPasswordForm } from "./ForgotPasswordForm";

const submit = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;

describe("ForgotPasswordForm", () => {
	beforeEach(() => {
		actions.requestPasswordReset.mockReset();
		actions.requestPasswordReset.mockResolvedValue(undefined);
		toastSpy.success.mockReset();
		toastSpy.error.mockReset();
	});

	it("shows the expired-link notice when arriving from a stale link", () => {
		renderWithIntl(<ForgotPasswordForm expired />);
		expect(screen.getByRole("alert")).toHaveTextContent(/expired|new link/i);
	});

	it("hides the expired notice by default", () => {
		renderWithIntl(<ForgotPasswordForm />);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("calls the action and toasts on a successful request", async () => {
		actions.requestPasswordReset.mockResolvedValue({ message: "Reset link sent." });
		renderWithIntl(<ForgotPasswordForm />);

		const email = document.querySelector('input[type="email"]') as HTMLInputElement;
		await userEvent.type(email, "user@example.com");
		await userEvent.click(submit());

		await waitFor(() =>
			expect(actions.requestPasswordReset).toHaveBeenCalledWith({
				email: "user@example.com",
			}),
		);
		expect(toastSpy.success).toHaveBeenCalledWith("Reset link sent.");
		// The form is reset after a successful send.
		await waitFor(() => expect(email.value).toBe(""));
	});

	it("shows a root error when the action fails", async () => {
		actions.requestPasswordReset.mockResolvedValue({ error: "Something went wrong" });
		renderWithIntl(<ForgotPasswordForm />);

		await userEvent.type(document.querySelector('input[type="email"]')!, "user@example.com");
		await userEvent.click(submit());

		expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
		expect(toastSpy.success).not.toHaveBeenCalled();
	});
});
