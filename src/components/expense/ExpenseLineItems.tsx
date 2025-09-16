import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';

interface ExpenseLine {
  account_id: string;
  description: string;
  amount: number;
}

interface AccountOption {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_subtype: string | null;
}

interface ExpenseLineItemsProps {
  lines: ExpenseLine[];
  onLinesChange: (lines: ExpenseLine[]) => void;
  accounts: AccountOption[];
}

export function ExpenseLineItems({ lines, onLinesChange, accounts }: ExpenseLineItemsProps) {
  const addLine = () => {
    onLinesChange([...lines, { account_id: '', description: '', amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      onLinesChange(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof ExpenseLine, value: string | number) => {
    const updated = lines.map((line, i) => 
      i === index ? { ...line, [field]: value } : line
    );
    onLinesChange(updated);
  };

  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Expense Line Items</Label>
        <Button type="button" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4 mr-1" />
          Add Line
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
            <div className="col-span-4">
              <Label className="text-xs">Account</Label>
              <Select
                value={line.account_id}
                onValueChange={(value) => updateLine(index, 'account_id', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-4">
              <Label className="text-xs">Description</Label>
              <Input
                value={line.description}
                onChange={(e) => updateLine(index, 'description', e.target.value)}
                placeholder="Line description"
                className="h-8"
              />
            </div>

            <div className="col-span-3">
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={line.amount || ''}
                onChange={(e) => updateLine(index, 'amount', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="h-8"
              />
            </div>

            <div className="col-span-1 flex justify-center">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => removeLine(index)}
                disabled={lines.length === 1}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end p-3 bg-muted rounded-lg">
        <div className="text-sm font-medium">
          Total: {new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD' 
          }).format(total)}
        </div>
      </div>
    </div>
  );
}