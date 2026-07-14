"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/shared/lib/utils";

function Menu({ ...props }: MenuPrimitive.Root.Props) {
	return <MenuPrimitive.Root {...props} />;
}

function MenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
	return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />;
}

function MenuContent({
	className,
	side = "bottom",
	sideOffset = 6,
	align = "end",
	alignOffset = 0,
	children,
	...props
}: MenuPrimitive.Popup.Props &
	Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<MenuPrimitive.Portal>
			<MenuPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				className="isolate z-50"
			>
				<MenuPrimitive.Popup
					data-slot="menu-content"
					className={cn(
						"z-50 min-w-40 origin-(--transform-origin) rounded-2xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/5 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				>
					{children}
				</MenuPrimitive.Popup>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

const menuItemClasses =
	"flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-start outline-none transition-colors select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground";

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
	return (
		<MenuPrimitive.Item
			data-slot="menu-item"
			className={cn(menuItemClasses, className)}
			{...props}
		/>
	);
}

function MenuLinkItem({ className, ...props }: MenuPrimitive.LinkItem.Props) {
	return (
		<MenuPrimitive.LinkItem
			data-slot="menu-link-item"
			className={cn(menuItemClasses, className)}
			{...props}
		/>
	);
}

export { Menu, MenuTrigger, MenuContent, MenuItem, MenuLinkItem };
