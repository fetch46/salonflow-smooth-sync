import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PaymentMethod() {
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Update Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Card Holder Name</label>
              <Input placeholder="Jane Doe" />
            </div>
            <div>
              <label className="text-sm">Card Number</label>
              <Input placeholder="4242 4242 4242 4242" />
            </div>
            <div>
              <label className="text-sm">Expiry</label>
              <Input placeholder="MM/YY" />
            </div>
            <div>
              <label className="text-sm">CVC</label>
              <Input placeholder="123" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled>Save (Coming soon)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}