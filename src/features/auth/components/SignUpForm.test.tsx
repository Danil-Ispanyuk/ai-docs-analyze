// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/shared/test/intl";

const actions = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ signUp: actions.signUp }));

import { SignUpForm } from "./SignUpForm";

const submit = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;
const fill = async () => {
	await userEvent.type(document.querySelector('input[type="text"]')!, "Ada Lovelace");
	await userEvent.type(document.querySelector('input[type="email"]')!, "ada@example.com");
	await userEvent.type(document.querySelector('input[type="password"]')!, "supersecret");
};

describe("SignUpForm", () => {
	beforeEach(() => {
		actions.signUp.mockReset();
		actions.signUp.mockResolvedValue(undefined);
	});

	it("rejects a password shorter than 8 characters", async () => {
		renderWithIntl(<SignUpForm />);
		await userEvent.type(document.querySelector('input[type="text"]')!, "Ada");
		await userEvent.type(document.querySelector('input[type="email"]')!, "ada@example.com");
		await userEvent.type(document.querySelector('input[type="password"]')!, "short");
		await userEvent.click(submit());

		expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
		expect(actions.signUp).not.toHaveBeenCalled();
	});

	it("calls signUp with the full payload on a valid submit", async () => {
		renderWithIntl(<SignUpForm />);
		await fill();
		await userEvent.click(submit());

		await waitFor(() =>
			expect(actions.signUp).toHaveBeenCalledWith({
				fullName: "Ada Lovelace",
				email: "ada@example.com",
				password: "supersecret",
			}),
		);
	});

	it("replaces the form with the confirmation message on success", async () => {
		actions.signUp.mockResolvedValue({ message: "Check your inbox to confirm." });
		renderWithIntl(<SignUpForm />);
		await fill();
		await userEvent.click(submit());

		expect(await screen.findByText("Check your inbox to confirm.")).toBeInTheDocument();
		// The form (and its submit button) is gone once confirmation shows.
		expect(document.querySelector('button[type="submit"]')).toBeNull();
	});

	it("shows a root error when the action fails", async () => {
		actions.signUp.mockResolvedValue({ error: "Email already registered" });
		renderWithIntl(<SignUpForm />);
		await fill();
		await userEvent.click(submit());

		expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered");
	});
});
