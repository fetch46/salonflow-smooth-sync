import * as React from "react";
import { Menu, Bell, User2 } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown";

export type NavbarProps = {
	title?: string;
	onMenuToggle?: () => void;
	endSlot?: React.ReactNode;
	className?: string;
};

export function Navbar({ title = "Dashboard", onMenuToggle, endSlot, className }: NavbarProps) {
	return (
		<header className={`sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur ${className ?? ""}`}>
			<div className="flex h-14 items-center gap-2 px-3 sm:px-4">
				<Button variant="ghost" size="icon" aria-label="Open menu" onClick={onMenuToggle} className="md:hidden">
					<Menu className="h-5 w-5" />
				</Button>
				<div className="font-semibold tracking-tight text-foreground truncate">{title}</div>
				<div className="ml-auto flex items-center gap-2">
					<div className="hidden sm:block">
						<Input placeholder="Search…" className="w-[220px]" aria-label="Search" />
					</div>
					<Button variant="ghost" size="icon" aria-label="Notifications">
						<Bell className="h-5 w-5" />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" aria-label="Account">
								<User2 className="h-5 w-5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							<DropdownMenuItem>Profile</DropdownMenuItem>
							<DropdownMenuItem>Settings</DropdownMenuItem>
							<DropdownMenuItem>Sign out</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{endSlot}
				</div>
			</div>
		</header>
	);
}