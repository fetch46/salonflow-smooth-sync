import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MpesaPaymentModal } from "./MpesaPaymentModal";
import { Smartphone } from "lucide-react";

interface MpesaPaymentButtonProps {
  amount: number;
  organizationId: string;
  accountReference: string;
  transactionDesc: string;
  referenceType?: string;
  referenceId?: string;
  onSuccess?: (paymentId: string) => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const MpesaPaymentButton = ({
  amount,
  organizationId,
  accountReference,
  transactionDesc,
  referenceType,
  referenceId,
  onSuccess,
  disabled = false,
  variant = "default",
  size = "default",
  className
}: MpesaPaymentButtonProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setModalOpen(true)}
        disabled={disabled}
        className={className}
      >
        <Smartphone className="mr-2 h-4 w-4" />
        Pay {formatAmount(amount)} via M-Pesa
      </Button>

      <MpesaPaymentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        amount={amount}
        organizationId={organizationId}
        accountReference={accountReference}
        transactionDesc={transactionDesc}
        referenceType={referenceType}
        referenceId={referenceId}
        onSuccess={onSuccess}
      />
    </>
  );
};