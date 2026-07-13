import { getLocale, getTranslations } from "next-intl/server";
import type { InvoiceSummary } from "@/features/profile/service";

interface PaymentHistoryProps {
	invoices: InvoiceSummary[];
}

export async function PaymentHistory({ invoices }: PaymentHistoryProps) {
	const t = await getTranslations();
	const locale = await getLocale();

	if (invoices.length === 0) {
		return <p className="text-sm text-foreground/60">{t("Profile.noPayments")}</p>;
	}

	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	return (
		<ul className="divide-y divide-border">
			{invoices.map((invoice) => (
				<li key={invoice.id} className="flex items-center justify-between gap-3 py-3 text-sm">
					<div className="min-w-0">
						<p className="font-medium tabular-nums">
							{new Intl.NumberFormat(locale, {
								style: "currency",
								currency: invoice.currency.toUpperCase(),
							}).format(invoice.amount / 100)}
						</p>
						<p className="text-xs text-foreground/55">{dateFormat.format(invoice.createdAt)}</p>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-xs text-foreground/60 capitalize">
							{invoice.status ?? t("Profile.statusUnknown")}
						</span>
						{invoice.hostedInvoiceUrl && (
							<a
								href={invoice.hostedInvoiceUrl}
								target="_blank"
								rel="noreferrer"
								className="text-xs text-primary underline-offset-4 hover:underline"
							>
								{t("Profile.viewInvoice")}
							</a>
						)}
					</div>
				</li>
			))}
		</ul>
	);
}
