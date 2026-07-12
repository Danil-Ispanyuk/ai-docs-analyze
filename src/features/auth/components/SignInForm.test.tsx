// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";

const actions = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ signIn: actions.signIn }));

import { SignInForm } from "./SignInForm";

function submitButton() {
	return document.querySelector('button[type="submit"]') as HTMLButtonElement;
}

describe("SignInForm", () => {
	beforeEach(() => {
		actions.signIn.mockReset();
		actions.signIn.mockResolvedValue(undefined);
	});

	it("blocks submit and shows validation errors for empty fields", async () => {
		renderWithIntl(<SignInForm />);
		await userEvent.click(submitButton());

		expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
		expect(screen.getByText("Enter your password")).toBeInTheDocument();
		expect(actions.signIn).not.toHaveBeenCalled();
	});

	it("calls signIn with the entered credentials on a valid submit", async () => {
		renderWithIntl(<SignInForm />);

		await userEvent.type(document.querySelector('input[type="email"]')!, "user@example.com");
		await userEvent.type(document.querySelector('input[type="password"]')!, "secret");
		await userEvent.click(submitButton());

		await waitFor(() =>
			expect(actions.signIn).toHaveBeenCalledWith({
				email: "user@example.com",
				password: "secret",
			}),
		);
	});

	it("surfaces a root error returned by the action", async () => {
		actions.signIn.mockResolvedValue({ error: "Invalid login credentials" });
		renderWithIntl(<SignInForm />);

		await userEvent.type(document.querySelector('input[type="email"]')!, "user@example.com");
		await userEvent.type(document.querySelector('input[type="password"]')!, "secret");
		await userEvent.click(submitButton());

		expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
	});
});
