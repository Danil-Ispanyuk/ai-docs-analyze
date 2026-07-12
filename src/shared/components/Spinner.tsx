export function Spinner() {
	return (
		<div className="flex h-full items-center justify-center">
			<span
				className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent text-foreground/40"
				aria-hidden
			/>
		</div>
	);
}
