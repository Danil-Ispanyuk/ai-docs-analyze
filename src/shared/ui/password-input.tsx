"use client";

import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, EyeOffIcon } from "@/shared/assets/icons";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { Input } from "./input";

function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
	const t = useT();
	const [visible, setVisible] = React.useState(false);

	return (
		<div className="relative">
			<Input type={visible ? "text" : "password"} className={cn("pe-10", className)} {...props} />
			<button
				type="button"
				onClick={() => setVisible((previous) => !previous)}
				aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
				aria-pressed={visible}
				className="absolute end-0 top-0 flex h-9 w-10 items-center justify-center rounded-e-4xl text-foreground/50 transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
			>
				<HugeiconsIcon icon={visible ? EyeOffIcon : EyeIcon} className="size-4" />
			</button>
		</div>
	);
}

export { PasswordInput };
