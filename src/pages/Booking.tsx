import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ChevronLeft, ChevronRight, Check, Calendar, User, DollarSign, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSaas } from "@/lib/saas";
import { postReceiptPaymentToLedger } from "@/utils/ledger";

const Booking = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    card: "",
    expiry: "",
    cvc: ""
  });

  // Reservation fee state
  const [collectReservationFee, setCollectReservationFee] = useState(false);
  const [reservationAmount, setReservationAmount] = useState("");
  const [reservationPaymentMethod, setReservationPaymentMethod] = useState("");
  const [reservationTransactionNumber, setReservationTransactionNumber] = useState("");
  const { organization } = useSaas();

  const steps = [
    { number: 1, title: "Services", icon: User },
    { number: 2, title: "Date & Time", icon: Calendar },
    { number: 3, title: "Staff", icon: User },
    { number: 4, title: "Confirmation", icon: Check }
  ];

  const canProceed = () => {
    if (currentStep === 1) return selectedServices.length > 0;
    if (currentStep === 2) return selectedDate && selectedTime;
    if (currentStep === 3) return selectedStaff;
    return true;
  };

  const isReservationValid = () => {
    if (!collectReservationFee) return true;
    if (!reservationAmount || isNaN(Number(reservationAmount)) || Number(reservationAmount) <= 0) return false;
    if (!reservationPaymentMethod) return false;
    if (reservationPaymentMethod === 'mpesa' && !reservationTransactionNumber.trim()) return false;
    return true;
  };

  const isFormValid = () => {
    const basic = Object.values(form).every(val => String(val).trim() !== "");
    return basic && isReservationValid();
  };

  const handleBookingSubmit = async () => {
    if (!isFormValid()) return;

    const bookingData = {
      services: selectedServices,
      date: selectedDate,
      time: selectedTime,
      staff: selectedStaff,
      customer: form,
      reservation: collectReservationFee
        ? {
            amount: Number(reservationAmount),
            payment_method: reservationPaymentMethod,
            transaction_number: reservationPaymentMethod === 'mpesa' ? reservationTransactionNumber.trim() : undefined,
          }
        : null,
    };

    try {
      // Create a receipt for the booking services (assuming single service price sum = 0 for placeholder)
      const subtotal = 0; // Replace with sum of selected service prices when available
      const receiptNumber = `RCT-${Date.now().toString().slice(-6)}`;
      const { data: receipt, error } = await supabase
        .from('receipts')
        .insert([
          {
            receipt_number: receiptNumber,
            customer_id: null,
            subtotal,
            tax_amount: 0,
            discount_amount: 0,
            total_amount: subtotal,
            status: collectReservationFee ? 'partial' : 'open',
            notes: `Booking for ${form.name}`,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      if (collectReservationFee && receipt) {
        const { error: payErr } = await supabase
          .from('receipt_payments')
          .insert([
            {
              receipt_id: receipt.id,
              amount: Number(reservationAmount),
              method: reservationPaymentMethod,
              reference_number: reservationPaymentMethod === 'mpesa' ? reservationTransactionNumber.trim() : null,
            },
          ]);
        if (payErr) throw payErr;

        // Post to ledger
        if (organization?.id) {
          try {
            await postReceiptPaymentToLedger({
              organizationId: organization.id,
              amount: Number(reservationAmount),
              method: reservationPaymentMethod,
              receiptId: receipt.id,
              receiptNumber,
            });
          } catch (ledgerErr) {
            console.warn('Ledger posting failed (booking reservation)', ledgerErr);
          }
        }
      }

      console.log("Booking submitted:", bookingData);
      toast.success('Booking created and receipt generated');
      alert("Booking submitted successfully!");
    } catch (e: any) {
      console.error('Error creating booking receipt:', e);
      toast.error(e?.message || 'Failed to create receipt for booking');
      alert("Booking submitted, but failed to create receipt.");
    }
  };

  const renderStepContent = () => {
    if (currentStep !== 4) {
      return (
        <div className="text-muted-foreground text-center p-12 border border-dashed rounded-lg">
          <p>Step {currentStep} content will go here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-muted-foreground">
          Review your details and optionally collect a reservation fee.
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reservation Fee (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <input
                id="collect-fee"
                type="checkbox"
                checked={collectReservationFee}
                onChange={(e) => setCollectReservationFee(e.target.checked)}
              />
              <Label htmlFor="collect-fee">Collect reservation fee now</Label>
            </div>

            {collectReservationFee && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="reservation-amount">Amount</Label>
                  <Input
                    id="reservation-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={reservationAmount}
                    onChange={(e) => setReservationAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reservation-method">Payment Method</Label>
                  <Select value={reservationPaymentMethod} onValueChange={setReservationPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2"><DollarSign className="w-4 h-4"/>Cash</div>
                      </SelectItem>
                      <SelectItem value="mpesa">
                        <div className="flex items-center gap-2"><Phone className="w-4 h-4"/>M-Pesa</div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center gap-2"><CreditCard className="w-4 h-4"/>Card</div>
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        <div className="flex items-center gap-2"><DollarSign className="w-4 h-4"/>Bank Transfer</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reservationPaymentMethod === 'mpesa' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="reservation-txn">M-Pesa Transaction Number<span className="text-red-500">*</span></Label>
                    <Input
                      id="reservation-txn"
                      placeholder="e.g. QFG3XXXXXX"
                      value={reservationTransactionNumber}
                      onChange={(e) => setReservationTransactionNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Required when paying via M-Pesa</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Book Appointment</h1>
          <p className="text-muted-foreground">Step-by-step salon service booking</p>
        </div>
      </div>

      {/* Steps Header */}
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-6 flex-wrap">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.number ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={`text-sm ${
                  currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>Step {currentStep}</CardTitle>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        {currentStep < 4 ? (
          <Button
            onClick={() => setCurrentStep(prev => prev + 1)}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="px-8"
            onClick={handleBookingSubmit}
            disabled={!isFormValid()}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Complete Booking
          </Button>
        )}
      </div>
    </div>
  );
};

export default Booking;
