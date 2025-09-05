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
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.12 }}
				className="fixed inset-0 z-50"
			>
				<DialogContent className={className} {...props}>
					{children}
				</DialogContent>
			</motion.div>
		</AnimatePresence>
	);
};

export const ModalHeader = DialogHeader;
export const ModalTitle = DialogTitle;
export const ModalDescription = DialogDescription;
export const ModalFooter = DialogFooter;
export const ModalClose = DialogClose;