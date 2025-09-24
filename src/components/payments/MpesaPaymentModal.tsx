import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { z } from "zod";

interface MpesaPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  organizationId: string;
  accountReference: string;
  transactionDesc: string;
  referenceType?: string;
  referenceId?: string;
  onSuccess?: (paymentId: string) => void;
}

const phoneSchema = z.string()
  .min(10, "Phone number must be at least 10 digits")
  .max(15, "Phone number must be at most 15 digits")
  .regex(/^(\+?254|0)?[17]\d{8}$/, "Please enter a valid Kenyan phone number");

export const MpesaPaymentModal = ({
  open,
  onOpenChange,
  amount,
  organizationId,
  accountReference,
  transactionDesc,
  referenceType,
  referenceId,
  onSuccess
}: MpesaPaymentModalProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'checking' | 'success' | 'failed'>('idle');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    try {
      phoneSchema.parse(phoneNumber);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid Phone Number",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    setPaymentStatus('pending');

    try {
      console.log('Initiating Mpesa payment:', {
        organizationId,
        phoneNumber,
        amount,
        accountReference,
        transactionDesc
      });

      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          organizationId,
          phoneNumber: phoneNumber.trim(),
          amount,
          accountReference,
          transactionDesc,
          referenceType,
          referenceId
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Payment initiation failed');
      }

      console.log('STK Push successful:', data.data);

      setPaymentId(data.data.paymentId);
      setCheckoutRequestId(data.data.checkoutRequestId);
      
      toast({
        title: "Payment Request Sent",
        description: "Please check your phone and enter your M-Pesa PIN to complete the payment.",
      });

      // Start checking payment status
      setPaymentStatus('checking');
      startPaymentStatusCheck(data.data.paymentId);

    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('failed');
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate M-Pesa payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startPaymentStatusCheck = (paymentId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // Check for 2 minutes (60 * 2 seconds)
    
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('mpesa_payments')
          .select('status, mpesa_receipt_number')
          .eq('id', paymentId)
          .single();

        if (error) throw error;

        console.log('Payment status check:', data);

        if (data.status === 'success') {
          setPaymentStatus('success');
          toast({
            title: "Payment Successful",
            description: `Payment completed successfully. Receipt: ${data.mpesa_receipt_number}`,
          });
          onSuccess?.(paymentId);
          return;
        } else if (data.status === 'failed') {
          setPaymentStatus('failed');
          toast({
            title: "Payment Failed",
            description: "Payment was not completed. Please try again.",
            variant: "destructive",
          });
          return;
        }

        // Continue checking if still pending
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000); // Check every 2 seconds
        } else {
          // Timeout reached
          setPaymentStatus('failed');
          toast({
            title: "Payment Timeout",
            description: "Payment status check timed out. Please verify your payment manually.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Status check error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000);
        }
      }
    };

    // Start checking after 5 seconds to allow for processing
    setTimeout(checkStatus, 5000);
  };

  const handleClose = () => {
    if (paymentStatus === 'pending' || paymentStatus === 'checking') {
      toast({
        title: "Payment in Progress",
        description: "Please wait for the payment to complete before closing.",
        variant: "destructive",
      });
      return;
    }
    
    // Reset state
    setPhoneNumber("");
    setPaymentStatus('idle');
    setPaymentId(null);
    setCheckoutRequestId(null);
    onOpenChange(false);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const renderPaymentStatus = () => {
    switch (paymentStatus) {
      case 'pending':
        return (
          <div className="flex items-center space-x-2 text-blue-600">
            <LoadingSpinner className="h-4 w-4" />
            <span>Sending payment request...</span>
          </div>
        );
      case 'checking':
        return (
          <div className="flex items-center space-x-2 text-yellow-600">
            <Clock className="h-4 w-4" />
            <span>Waiting for payment confirmation...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Payment completed successfully!</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span>Payment failed. Please try again.</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>M-Pesa Payment</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formatAmount(amount)}
            </div>
            <div className="text-sm text-muted-foreground">
              {transactionDesc}
            </div>
          </div>

          {paymentStatus === 'idle' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="0712345678 or +254712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Enter your Safaricom M-Pesa phone number
                </div>
              </div>
            </form>
          )}

          {renderPaymentStatus()}
        </div>

        <DialogFooter>
          {paymentStatus === 'idle' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading && <LoadingSpinner className="mr-2 h-4 w-4" />}
                Pay with M-Pesa
              </Button>
            </>
          ) : paymentStatus === 'success' ? (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          ) : paymentStatus === 'failed' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setPaymentStatus('idle');
                  setPaymentId(null);
                  setCheckoutRequestId(null);
                }}
              >
                Try Again
              </Button>
            </>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Please complete the payment on your phone
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};