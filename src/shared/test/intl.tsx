import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/shared/config/i18n/messages/en.json";

// Renders a component wrapped in the real next-intl provider with the app's English
// messages, so `useT()` resolves actual copy (and missing keys surface as failures).
// Test-only helper — not a *.test file, so Vitest won't collect it.
export function renderWithIntl(ui: ReactElement) {
	return render(
		<NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
			{ui}
		</NextIntlClientProvider>,
	);
}
