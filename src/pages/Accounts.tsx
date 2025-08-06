import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, DollarSign, Building, TrendingUp, Edit2, Trash2, FileText, Calculator } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_subtype: string;
  parent_account_id: string | null;
  description: string | null;
  is_active: boolean;
  opening_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

interface AccountTransaction {
  id: string;
  account_id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

const ACCOUNT_TYPES = {
  "Asset": {
    subtypes: ["Cash", "Bank", "Accounts Receivable", "Stock", "Fixed Asset", "Other Asset"],
    normalBalance: "Debit"
  },
  "Liability": {
    subtypes: ["Accounts Payable", "Current Liability", "Non Current Liability", "Other Liability"],
    normalBalance: "Credit"
  },
  "Equity": {
    subtypes: ["Equity", "Retained Earnings"],
    normalBalance: "Credit"
  },
  "Income": {
    subtypes: ["Income", "Other Income"],
    normalBalance: "Credit"
  },
  "Expense": {
    subtypes: ["Expense", "Cost of Goods Sold", "Other Expense"],
    normalBalance: "Debit"
  }
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState("chart");

  const [formData, setFormData] = useState({
    account_code: "",
    account_name: "",
    account_type: "",
    account_subtype: "",
    parent_account_id: "",
    description: "",
    opening_balance: "",
    is_active: true,
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("account_code");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountTransactions = async (accountId: string) => {
    try {
      const { data, error } = await supabase
        .from("account_transactions")
        .select("*")
        .eq("account_id", accountId)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to fetch transactions");
    }
  };

  const generateAccountCode = (accountType: string, accountSubtype: string) => {
    const typeCodeMap = {
      "Asset": "1",
      "Liability": "2", 
      "Equity": "3",
      "Income": "4",
      "Expense": "5"
    };

    const baseCode = typeCodeMap[accountType as keyof typeof typeCodeMap] || "9";
    const existingCodes = accounts
      .filter(acc => acc.account_code.startsWith(baseCode))
      .map(acc => parseInt(acc.account_code))
      .filter(code => !isNaN(code));
    
    const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : parseInt(baseCode + "001");
    return nextNumber.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const accountData = {
        ...formData,
        account_code: formData.account_code || generateAccountCode(formData.account_type, formData.account_subtype),
        opening_balance: parseFloat(formData.opening_balance) || 0,
        current_balance: parseFloat(formData.opening_balance) || 0,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("accounts")
          .update(accountData)
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast.success("Account updated successfully");
      } else {
        const { error } = await supabase
          .from("accounts")
          .insert([accountData]);

        if (error) throw error;
        toast.success("Account created successfully");
      }

      resetForm();
      setIsModalOpen(false);
      fetchAccounts();
    } catch (error) {
      console.error("Error saving account:", error);
      toast.error("Failed to save account");
    }
  };

  const handleEdit = (account: Account) => {
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      account_subtype: account.account_subtype,
      parent_account_id: account.parent_account_id || "",
      description: account.description || "",
      opening_balance: account.opening_balance.toString(),
      is_active: account.is_active,
    });
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this account?")) {
      try {
        const { error } = await supabase
          .from("accounts")
          .delete()
          .eq("id", id);

        if (error) throw error;
        toast.success("Account deleted successfully");
        fetchAccounts();
      } catch (error) {
        console.error("Error deleting account:", error);
        toast.error("Failed to delete account");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      account_code: "",
      account_name: "",
      account_type: "",
      account_subtype: "",
      parent_account_id: "",
      description: "",
      opening_balance: "",
      is_active: true,
    });
    setEditingAccount(null);
  };

  const getAccountTypeColor = (type: string) => {
    const colors = {
      "Asset": "bg-blue-100 text-blue-800",
      "Liability": "bg-red-100 text-red-800",
      "Equity": "bg-green-100 text-green-800",
      "Income": "bg-emerald-100 text-emerald-800",
      "Expense": "bg-orange-100 text-orange-800"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getAccountBalance = (account: Account) => {
    const normalBalance = ACCOUNT_TYPES[account.account_type as keyof typeof ACCOUNT_TYPES]?.normalBalance;
    return {
      amount: Math.abs(account.current_balance),
      type: account.current_balance >= 0 ? normalBalance : (normalBalance === "Debit" ? "Credit" : "Debit")
    };
  };

  const filteredAccounts = accounts.filter(account =>
    account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.account_code.includes(searchTerm) ||
    account.account_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate financial summaries
  const totalAssets = accounts
    .filter(acc => acc.account_type === "Asset")
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const totalLiabilities = accounts
    .filter(acc => acc.account_type === "Liability")
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const totalEquity = accounts
    .filter(acc => acc.account_type === "Equity")
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const totalIncome = accounts
    .filter(acc => acc.account_type === "Income")
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const totalExpenses = accounts
    .filter(acc => acc.account_type === "Expense")
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Accounts Management
          </h1>
          <p className="text-muted-foreground">
            Manage your chart of accounts and financial structure
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-gradient-to-r from-pink-500 to-purple-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Edit Account" : "Create New Account"}
              </DialogTitle>
              <DialogDescription>
                {editingAccount ? "Update account information" : "Add a new account to your chart of accounts"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_code">Account Code</Label>
                  <Input
                    id="account_code"
                    value={formData.account_code}
                    onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <Label htmlFor="account_name">Account Name *</Label>
                  <Input
                    id="account_name"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_type">Account Type *</Label>
                  <Select 
                    value={formData.account_type} 
                    onValueChange={(value) => setFormData({ ...formData, account_type: value, account_subtype: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(ACCOUNT_TYPES).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="account_subtype">Account Subtype *</Label>
                  <Select 
                    value={formData.account_subtype} 
                    onValueChange={(value) => setFormData({ ...formData, account_subtype: value })}
                    disabled={!formData.account_type}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subtype" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.account_type && ACCOUNT_TYPES[formData.account_type as keyof typeof ACCOUNT_TYPES]?.subtypes.map((subtype) => (
                        <SelectItem key={subtype} value={subtype}>
                          {subtype}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parent_account_id">Parent Account</Label>
                  <Select 
                    value={formData.parent_account_id} 
                    onValueChange={(value) => setFormData({ ...formData, parent_account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent account (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter(acc => acc.account_type === formData.account_type && acc.id !== editingAccount?.id)
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_code} - {account.account_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="opening_balance">Opening Balance</Label>
                  <Input
                    id="opening_balance"
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-pink-500 to-purple-600">
                  {editingAccount ? "Update" : "Create"} Account
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Assets</CardTitle>
            <Building className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">${totalAssets.toFixed(2)}</div>
            <p className="text-xs text-blue-600">Current book value</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Total Liabilities</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">${totalLiabilities.toFixed(2)}</div>
            <p className="text-xs text-red-600">Outstanding obligations</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Equity</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">${totalEquity.toFixed(2)}</div>
            <p className="text-xs text-green-600">Owner's equity</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">${totalIncome.toFixed(2)}</div>
            <p className="text-xs text-emerald-600">Revenue earned</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Total Expenses</CardTitle>
            <Calculator className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">${totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-orange-600">Operating costs</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Account Transactions</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Chart of Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-pink-600" />
                Chart of Accounts
              </CardTitle>
              <CardDescription>
                Complete list of all accounts in your accounting system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading accounts...</p>
                  </div>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No accounts found matching your search" : "No accounts found"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subtype</TableHead>
                      <TableHead className="text-right">Current Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => {
                      const balance = getAccountBalance(account);
                      return (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.account_code}</TableCell>
                          <TableCell>{account.account_name}</TableCell>
                          <TableCell>
                            <Badge className={getAccountTypeColor(account.account_type)}>
                              {account.account_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{account.account_subtype}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-medium">${balance.amount.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">{balance.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.is_active ? "default" : "secondary"}>
                              {account.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedAccount(account);
                                  fetchAccountTransactions(account.id);
                                  setActiveTab("transactions");
                                }}
                              >
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(account)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(account.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Transactions</CardTitle>
              <CardDescription>
                {selectedAccount 
                  ? `Transaction history for ${selectedAccount.account_name}` 
                  : "Select an account to view its transaction history"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedAccount ? (
                transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for this account
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.transaction_date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell className="text-right">
                            {transaction.debit_amount > 0 && `$${transaction.debit_amount.toFixed(2)}`}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.credit_amount > 0 && `$${transaction.credit_amount.toFixed(2)}`}
                          </TableCell>
                          <TableCell>
                            {transaction.reference_type && (
                              <Badge variant="outline">
                                {transaction.reference_type}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select an account from the Chart of Accounts to view its transactions
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Balance Sheet</CardTitle>
                <CardDescription>Financial position as of today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-blue-700">ASSETS</h4>
                  <div className="ml-4 space-y-1">
                    {accounts.filter(acc => acc.account_type === "Asset").map(account => (
                      <div key={account.id} className="flex justify-between text-sm">
                        <span>{account.account_name}</span>
                        <span>${account.current_balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Assets</span>
                      <span>${totalAssets.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-red-700">LIABILITIES</h4>
                  <div className="ml-4 space-y-1">
                    {accounts.filter(acc => acc.account_type === "Liability").map(account => (
                      <div key={account.id} className="flex justify-between text-sm">
                        <span>{account.account_name}</span>
                        <span>${account.current_balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Liabilities</span>
                      <span>${totalLiabilities.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-green-700">EQUITY</h4>
                  <div className="ml-4 space-y-1">
                    {accounts.filter(acc => acc.account_type === "Equity").map(account => (
                      <div key={account.id} className="flex justify-between text-sm">
                        <span>{account.account_name}</span>
                        <span>${account.current_balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Equity</span>
                      <span>${totalEquity.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss Statement</CardTitle>
                <CardDescription>Income and expenses for current period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-emerald-700">INCOME</h4>
                  <div className="ml-4 space-y-1">
                    {accounts.filter(acc => acc.account_type === "Income").map(account => (
                      <div key={account.id} className="flex justify-between text-sm">
                        <span>{account.account_name}</span>
                        <span>${account.current_balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Income</span>
                      <span>${totalIncome.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-orange-700">EXPENSES</h4>
                  <div className="ml-4 space-y-1">
                    {accounts.filter(acc => acc.account_type === "Expense").map(account => (
                      <div key={account.id} className="flex justify-between text-sm">
                        <span>{account.account_name}</span>
                        <span>${account.current_balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Expenses</span>
                      <span>${totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t-2 pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Net Profit/Loss</span>
                    <span className={totalIncome - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}>
                      ${(totalIncome - totalExpenses).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}