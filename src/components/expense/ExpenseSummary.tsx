import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, DollarSign, Calendar, Receipt, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationCurrency } from "@/lib/saas/hooks";

interface ExpenseSummaryProps {
  expense: {
    expense_number: string;
    vendor_name: string;
    description: string;
    amount: number;
    expense_date: string;
    category: string;
    payment_method: string;
    status: string;
    notes?: string;
  };
  expenseId?: string;
}

interface JournalEntry {
  id: string;
  account_id: string;
  account_code?: string;
  account_name: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  transaction_date: string;
}

export default function ExpenseSummary({ expense, expenseId }: ExpenseSummaryProps) {
  const { format: formatCurrency } = useOrganizationCurrency();
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expenseId && expense.status === "paid") {
      fetchJournalEntries();
    }
  }, [expenseId, expense.status]);

  const fetchJournalEntries = async () => {
    if (!expenseId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('account_transactions')
        .select(`
          id,
          account_id,
          description,
          debit_amount,
          credit_amount,
          transaction_date,
          accounts!inner(
            account_code,
            account_name
          )
        `)
        .or(`reference_id.eq.${expenseId},reference_id.eq.expense_payment_${expenseId}`)
        .in('reference_type', ['expense', 'expense_payment'])
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      const entries: JournalEntry[] = (data || []).map((entry: any) => ({
        id: entry.id,
        account_id: entry.account_id,
        account_code: entry.accounts?.account_code,
        account_name: entry.accounts?.account_name || 'Unknown Account',
        description: entry.description,
        debit_amount: entry.debit_amount || 0,
        credit_amount: entry.credit_amount || 0,
        transaction_date: entry.transaction_date,
      }));

      setJournalEntries(entries);
    } catch (error) {
      console.error('Error fetching journal entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'approved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const totalDebits = journalEntries.reduce((sum, entry) => sum + entry.debit_amount, 0);
  const totalCredits = journalEntries.reduce((sum, entry) => sum + entry.credit_amount, 0);

  return (
    <div className="space-y-4">
      {/* Expense Details */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Expense Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Expense #:</span>
              <p className="font-medium">{expense.expense_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <Badge className={`ml-2 ${getStatusColor(expense.status)}`}>
                {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Vendor:</span>
              <p className="font-medium">{expense.vendor_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>
              <p className="font-medium">{new Date(expense.expense_date).toLocaleDateString()}</p>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <span className="text-muted-foreground">Description:</span>
            <p className="font-medium">{expense.description}</p>
          </div>

          {expense.category && (
            <div>
              <span className="text-muted-foreground">Category:</span>
              <p className="font-medium">{expense.category}</p>
            </div>
          )}

          {expense.payment_method && (
            <div>
              <span className="text-muted-foreground">Payment Method:</span>
              <p className="font-medium">{expense.payment_method}</p>
            </div>
          )}

          <Separator />
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Amount:</span>
            <span className="text-xl font-bold text-emerald-600">
              {formatCurrency(expense.amount)}
            </span>
          </div>

          {expense.notes && (
            <>
              <Separator />
              <div>
                <span className="text-muted-foreground">Notes:</span>
                <p className="text-sm mt-1 p-2 bg-muted rounded">{expense.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Journal Entries */}
      {expense.status === "paid" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-blue-600" />
              Journal Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading journal entries...</div>
            ) : journalEntries.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                No journal entries found for this expense
              </div>
            ) : (
              <div className="space-y-3">
                {journalEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {entry.account_code ? `${entry.account_code} - ` : ''}{entry.account_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{entry.description}</div>
                    </div>
                    <div className="text-right space-y-1">
                      {entry.debit_amount > 0 && (
                        <div className="text-sm font-medium text-red-600">
                          Dr {formatCurrency(entry.debit_amount)}
                        </div>
                      )}
                      {entry.credit_amount > 0 && (
                        <div className="text-sm font-medium text-green-600">
                          Cr {formatCurrency(entry.credit_amount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {journalEntries.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                      <span className="font-medium">Totals:</span>
                      <div className="text-right space-y-1">
                        <div className="text-sm font-medium text-red-600">
                          Dr {formatCurrency(totalDebits)}
                        </div>
                        <div className="text-sm font-medium text-green-600">
                          Cr {formatCurrency(totalCredits)}
                        </div>
                      </div>
                    </div>
                    
                    {Math.abs(totalDebits - totalCredits) > 0.01 && (
                      <div className="flex items-center gap-2 text-amber-600 text-sm p-2 bg-amber-50 rounded">
                        <AlertTriangle className="h-4 w-4" />
                        Journal entries are not balanced! Difference: {formatCurrency(Math.abs(totalDebits - totalCredits))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}