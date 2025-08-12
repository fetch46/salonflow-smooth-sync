import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ShoppingCart, CreditCard, DollarSign, Package, Trash2, User, Receipt, Calculator } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createSaleWithFallback } from "@/utils/mockDatabase";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useOrganizationTaxRate } from "@/lib/saas/hooks";
import { Switch } from "@/components/ui/switch";

interface Product {
  id: string;
  name: string;
  type: string;
  sku: string;
  selling_price: number;
  cost_price: number;
  category: string | null;
  unit: string;
  is_active: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  total: number;
}

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface Sale {
  id: string;
  sale_number: string;
  customer_id: string | null;
  customer_name: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const PAYMENT_METHODS = [
  "Cash",
  "Credit Card", 
  "Debit Card",
  "Mobile Payment",
  "Bank Transfer",
  "Store Credit"
];

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);

  const { format: formatMoney } = useOrganizationCurrency();
  const orgTaxRate = useOrganizationTaxRate();
  const { organization } = useOrganization();

  const [paymentData, setPaymentData] = useState({
    payment_method: "",
    discount_percentage: 0,
    tax_percentage: 8.5, // Default tax rate
    notes: "",
    cash_received: "",
  });
  const [applyTax, setApplyTax] = useState<boolean>(false);

  useEffect(() => {
    setPaymentData(prev => ({ ...prev, tax_percentage: typeof orgTaxRate === 'number' ? orgTaxRate : prev.tax_percentage }))
  }, [orgTaxRate])

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);
  // Ensure products refetch when organization changes
  useEffect(() => {
    if (organization?.id) {
      fetchProducts();
    }
  }, [organization?.id, (organization?.settings as any)?.pos_default_location_id]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const defaultLocationId = ((organization?.settings as any) || {}).pos_default_location_id as string | undefined;
      if (defaultLocationId) {
        // First get item_ids that have stock at the default location
        const { data: levels, error: levelsError } = await supabase
          .from("inventory_levels")
          .select("item_id, quantity")
          .eq("location_id", defaultLocationId)
          .gt("quantity", 0);
        if (levelsError) throw levelsError;
        const itemIds = Array.from(new Set((levels || []).map((l: any) => l.item_id)));
        if (itemIds.length === 0) {
          setProducts([]);
        } else {
          const { data: items, error: itemsError } = await supabase
            .from("inventory_items")
            .select("*")
            .in("id", itemIds)
            .eq("is_active", true)
            .eq("type", "good")
            .eq("organization_id", organization?.id || "")
            .order("name");
          if (itemsError) throw itemsError;
          setProducts(items || []);
        }
      } else {
        // No default location set: show all active goods in organization
        const { data, error } = await supabase
          .from("inventory_items")
          .select("*")
          .eq("is_active", true)
          .eq("type", "good")
          .eq("organization_id", organization?.id || "")
          .order("name");
        if (error) throw error;
        setProducts(data || []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, phone")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { 
              ...item, 
              quantity: item.quantity + 1,
              total: (item.quantity + 1) * item.product.selling_price * (1 - item.discount / 100)
            }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        discount: 0,
        total: product.selling_price
      }]);
    }
    toast.success(`${product.name} added to cart`);
  };

  const updateCartItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item => 
      item.product.id === productId 
        ? { 
            ...item, 
            quantity,
            total: quantity * item.product.selling_price * (1 - item.discount / 100)
          }
        : item
    ));
  };

  const updateCartItemDiscount = (productId: string, discount: number) => {
    setCart(cart.map(item => 
      item.product.id === productId 
        ? { 
            ...item, 
            discount,
            total: item.quantity * item.product.selling_price * (1 - discount / 100)
          }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setPaymentData({
      payment_method: "",
      discount_percentage: 0,
      tax_percentage: 8.5,
      notes: "",
      cash_received: "",
    });
  };

  const generateSaleNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `SALE-${timestamp}`;
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const globalDiscount = subtotal * (paymentData.discount_percentage / 100);
    const discountedSubtotal = subtotal - globalDiscount;
    const taxAmount = applyTax ? (discountedSubtotal * (paymentData.tax_percentage / 100)) : 0;
    const total = discountedSubtotal + taxAmount;

    return {
      subtotal,
      globalDiscount,
      discountedSubtotal,
      taxAmount,
      total
    };
  };

  const processSale = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!paymentData.payment_method) {
      toast.error("Please select a payment method");
      return;
    }

    try {
      const totals = calculateTotals();
      const saleData = {
        sale_number: generateSaleNumber(),
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.full_name || "Walk-in Customer",
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: totals.globalDiscount,
        total_amount: totals.total,
        payment_method: paymentData.payment_method,
        status: "completed",
        notes: paymentData.notes || null,
      };

      // Use fallback function to handle missing database tables
      const sale = await createSaleWithFallback(supabase, saleData, cart);

      // Decrease inventory at default POS location if configured
      try {
        const defaultLocationId = ((organization?.settings as any) || {})?.pos_default_location_id as string | undefined;
        if (defaultLocationId) {
          for (const line of cart) {
            const itemId = line.product.id;
            const qty = Number(line.quantity || 0);
            if (!qty) continue;
            const { data: levelRows, error: levelErr } = await supabase
              .from("inventory_levels")
              .select("id, quantity")
              .eq("item_id", itemId)
              .eq("location_id", defaultLocationId)
              .limit(1);
            if (levelErr) throw levelErr;
            const existing = (levelRows || [])[0] as { id: string; quantity: number } | undefined;
            if (existing) {
              const newQty = Math.max(0, Number(existing.quantity || 0) - qty);
              await supabase.from("inventory_levels").update({ quantity: newQty }).eq("id", existing.id);
            } else {
              // No stock row exists; create one with zero (cannot go negative)
              await supabase.from("inventory_levels").insert([{ item_id: itemId, location_id: defaultLocationId, quantity: 0 }]);
            }
          }
        }
      } catch (invErr) {
        console.warn("Inventory decrement after sale failed:", invErr);
      }

      setCurrentSale(sale);
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
      toast.success("Sale completed successfully!");
      
    } catch (error) {
      console.error("Error processing sale:", error);
      toast.error("Failed to process sale");
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = calculateTotals();

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Products Section */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Point of Sale
              </h1>
              <p className="text-muted-foreground">
                Sell products and manage transactions
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-1"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                {searchTerm ? "No products found matching your search" : "No products available"}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">{product.name}</h3>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                      {product.category && (
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-green-600">
                          {formatMoney(product.selling_price)}
                        </span>
                        <Button size="sm" className="bg-gradient-to-r from-pink-500 to-purple-600">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 border-l bg-muted/20">
        <div className="p-6 h-full flex flex-col">
          {/* Cart Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Cart ({cart.length})
            </h2>
            {cart.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearCart}>
                Clear
              </Button>
            )}
          </div>

          {/* Customer Selection */}
          <div className="mb-4">
            <Label>Customer (Optional)</Label>
                          <Select 
               value={selectedCustomer ? selectedCustomer.id : "__walk_in__"} 
               onValueChange={(value) => {
                 if (value === "__walk_in__") {
                   setSelectedCustomer(null);
                   return;
                 }
                 const customer = customers.find(c => c.id === value);
                 setSelectedCustomer(customer || null);
               }}
             >
               <SelectTrigger>
                 <SelectValue placeholder="Select customer" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="__walk_in__">Walk-in Customer</SelectItem>
                 {customers.map((customer) => (
                   <SelectItem key={customer.id} value={customer.id}>
                     {customer.full_name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Cart is empty</p>
                <p className="text-sm">Click on products to add them</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <Card key={item.product.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          <p className="text-xs text-muted-foreground">{formatMoney(item.product.selling_price)} each</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartItemQuantity(item.product.id, item.quantity - 1)}
                            className="h-6 w-6 p-0"
                          >
                            -
                          </Button>
                          <Input
                            value={item.quantity}
                            onChange={(e) => updateCartItemQuantity(item.product.id, parseInt(e.target.value) || 0)}
                            className="w-12 h-6 text-center text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartItemQuantity(item.product.id, item.quantity + 1)}
                            className="h-6 w-6 p-0"
                          >
                            +
                          </Button>
                        </div>
                        <Input
                          type="number"
                          placeholder="Disc %"
                          value={item.discount}
                          onChange={(e) => updateCartItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                          className="w-16 h-6 text-xs"
                        />
                      </div>
                      
                      <div className="text-right">
                        <span className="font-semibold text-green-600">
                          {formatMoney(item.total)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Cart Totals */}
          {cart.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.globalDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({paymentData.discount_percentage}%):</span>
                    <span>-${totals.globalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Tax ({applyTax ? paymentData.tax_percentage : 0}%):
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                    <span>${totals.taxAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>

              <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-600" size="lg">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Checkout
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Payment</DialogTitle>
                    <DialogDescription>
                      Complete the sale by selecting payment method
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="payment_method">Payment Method *</Label>
                      <Select 
                        value={paymentData.payment_method} 
                        onValueChange={(value) => setPaymentData({...paymentData, payment_method: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="discount_percentage">Global Discount (%)</Label>
                        <Input
                          id="discount_percentage"
                          type="number"
                          step="0.1"
                          max="100"
                          value={paymentData.discount_percentage}
                          onChange={(e) => setPaymentData({...paymentData, discount_percentage: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="tax_percentage">Tax (%)</Label>
                        <Input
                          id="tax_percentage"
                          type="number"
                          step="0.1"
                          value={paymentData.tax_percentage}
                          onChange={(e) => setPaymentData({...paymentData, tax_percentage: parseFloat(e.target.value) || 0})}
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                          <span className="text-sm">Apply Tax</span>
                        </div>
                      </div>
                    </div>

                    {paymentData.payment_method === "Cash" && (
                      <div>
                        <Label htmlFor="cash_received">Cash Received</Label>
                        <Input
                          id="cash_received"
                          type="number"
                          step="0.01"
                          value={paymentData.cash_received}
                          onChange={(e) => setPaymentData({...paymentData, cash_received: e.target.value})}
                        />
                        {paymentData.cash_received && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Change: {formatMoney(parseFloat(paymentData.cash_received) - totals.total)}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={paymentData.notes}
                        onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                        rows={2}
                      />
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${totals.subtotal.toFixed(2)}</span>
                        </div>
                        {totals.globalDiscount > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Discount:</span>
                            <span>-${totals.globalDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            Tax:
                          </span>
                          <div className="flex items-center gap-2">
                            <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                            <span>${totals.taxAmount.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-1">
                          <span>Total:</span>
                          <span>${totals.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={processSale} className="bg-gradient-to-r from-pink-500 to-purple-600">
                        Complete Sale
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Sale Complete
            </DialogTitle>
          </DialogHeader>
          {currentSale && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">AURA OS</h3>
                <p className="text-sm text-muted-foreground">Thank you for your purchase!</p>
              </div>
              
              <div className="border-t border-b py-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Sale #:</span>
                  <span>{currentSale.sale_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{format(new Date(currentSale.created_at), "MMM dd, yyyy HH:mm")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{currentSale.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span>{currentSale.payment_method}</span>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatMoney(currentSale.subtotal)}</span>
                </div>
                {currentSale.discount_amount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span>-${currentSale.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatMoney(currentSale.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-1">
                  <span>Total:</span>
                  <span>{formatMoney(currentSale.total_amount)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    clearCart();
                  }}
                >
                  New Sale
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => {
                    // Here you would implement print functionality
                    toast.success("Receipt printing...");
                  }}
                >
                  Print Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}