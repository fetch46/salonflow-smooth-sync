import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "./dialog";

export type ModalProps = React.ComponentProps<typeof Dialog> & {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export const Modal = ({ children, open, onOpenChange, ...props }: ModalProps) => {
	return (
		<Dialog open={open} onOpenChange={onOpenChange} {...props}>
			{children}
		</Dialog>
	);
};

export const ModalTrigger = DialogTrigger;

export const ModalContent = ({ children, className, ...props }: React.ComponentProps<typeof DialogContent>) => {
	return (
		<DialogContent className={className} {...props}>
			{children}
		</DialogContent>
	);
};

export const ModalHeader = DialogHeader;
export const ModalTitle = DialogTitle;
export const ModalDescription = DialogDescription;
export const ModalFooter = DialogFooter;
export const ModalClose = DialogClose;