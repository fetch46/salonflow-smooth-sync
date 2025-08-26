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
import { createInvoiceWithFallback, recordInvoicePaymentWithFallback } from "@/utils/mockDatabase";
import { postInvoicePaymentToLedger } from "@/utils/ledger";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useOrganizationTaxRate } from "@/lib/saas/hooks";
import { Switch } from "@/components/ui/switch";
import { postSaleCOGSAndInventory } from "@/utils/ledger";
import { useSaas } from "@/lib/saas";


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
  "Mobile money",
  "Mobile Payment",
  "Bank Transfer",
  "Store Credit"
];

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; location_id?: string | null }>>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
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
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';

  const [paymentData, setPaymentData] = useState({
    payment_method: "",
    discount_percentage: 0,
    tax_percentage: 8.5, // Default tax rate
    notes: "",
    cash_received: "",
    transaction_number: "",
  });
  const [applyTax, setApplyTax] = useState<boolean>(false);

  useEffect(() => {
    setPaymentData(prev => ({ ...prev, tax_percentage: typeof orgTaxRate === 'number' ? orgTaxRate : prev.tax_percentage }))
  }, [orgTaxRate])

  useEffect(() => {
    fetchCustomers();
    (async () => {
      try {
        const { data: whs } = await supabase
          .from("warehouses")
          .select("id, name, location_id, is_active")
          .order("name");
        const active = (whs || []).filter((w: any) => w.is_active);
        setWarehouses(active.map((w: any) => ({ id: w.id, name: w.name, location_id: w.location_id || null })));
      } catch {}
      // Try to default from org settings: prefer default POS warehouse, then fallback via default location
      try {
        const settings = (organization?.settings as any) || {};
        const defaultWarehouseId = settings?.pos_default_warehouse_id as string | undefined;
        if (defaultWarehouseId) {
          setSelectedWarehouseId(defaultWarehouseId);
        } else {
          const defaultLocationId = settings?.pos_default_location_id as string | undefined;
          if (defaultLocationId) {
            const { data: loc } = await supabase
              .from("business_locations")
              .select("id, default_warehouse_id")
              .eq("id", defaultLocationId)
              .maybeSingle();
            const defWh = (loc as any)?.default_warehouse_id as string | undefined;
            if (defWh) setSelectedWarehouseId(defWh);
          }
        }
      } catch {}
      await fetchProducts();
    })();
  }, []);
  // Ensure products refetch when organization changes
  useEffect(() => {
    if (organization?.id) {
      fetchProducts();
    }
  }, [organization?.id, selectedWarehouseId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      if (selectedWarehouseId) {
        const { data: levels, error: levelsError } = await supabase
          .from("inventory_levels")
          .select("item_id, quantity")
          .eq("warehouse_id", selectedWarehouseId)
          .gt("quantity", 0);
        if (levelsError) throw levelsError;
        let itemIds = Array.from(new Set((levels || []).map((l: any) => l.item_id)));
        const qtyMap: Record<string, number> = {};
        for (const row of (levels || [])) {
          qtyMap[row.item_id] = (qtyMap[row.item_id] || 0) + Number(row.quantity || 0);
        }
        // Fallback: if no levels by warehouse, try levels by the warehouse's location
        if (itemIds.length === 0) {
          const wh = warehouses.find(w => w.id === selectedWarehouseId);
          const locId = wh?.location_id;
          if (locId) {
            const { data: locLevels, error: locLevelsError } = await supabase
              .from("inventory_levels")
              .select("item_id, quantity")
              .eq("location_id", locId)
              .gt("quantity", 0);
            if (locLevelsError) throw locLevelsError;
            itemIds = Array.from(new Set((locLevels || []).map((l: any) => l.item_id)));
            // Reset and build qty map from location levels
            for (const key of Object.keys(qtyMap)) delete qtyMap[key];
            for (const row of (locLevels || [])) {
              qtyMap[row.item_id] = (qtyMap[row.item_id] || 0) + Number(row.quantity || 0);
            }
          }
        }
        if (itemIds.length === 0) {
          setProducts([]);
          setProductQuantities({});
        } else {
          let itemsRes: any[] = [];
          try {
            if (organization?.id) {
              // Prefer items scoped to this organization, but also include global (NULL org) items
              const { data: items, error: itemsError } = await supabase
                .from("inventory_items")
                .select("*")
                .in("id", itemIds)
                .eq("is_active", true)
                .eq("type", "good")
                .or(`organization_id.eq.${organization.id},organization_id.is.null`)
                .order("name");
              if (itemsError) throw itemsError;
              itemsRes = items || [];
              // If none returned (e.g., data seeded without org ids), fall back to no org filter
              if (itemsRes.length === 0) {
                const { data: items2, error: itemsError2 } = await supabase
                  .from("inventory_items")
                  .select("*")
                  .in("id", itemIds)
                  .eq("is_active", true)
                  .eq("type", "good")
                  .order("name");
                if (itemsError2) throw itemsError2;
                itemsRes = items2 || [];
              }
            } else {
              // No organization context available; fetch by ids only
              const { data: items, error: itemsError } = await supabase
                .from("inventory_items")
                .select("*")
                .in("id", itemIds)
                .eq("is_active", true)
                .eq("type", "good")
                .order("name");
              if (itemsError) throw itemsError;
              itemsRes = items || [];
            }
          } catch (e: any) {
            // Fallback for schemas without organization_id
            const { data: items, error: itemsError } = await supabase
              .from("inventory_items")
              .select("*")
              .in("id", itemIds)
              .eq("is_active", true)
              .eq("type", "good")
              .order("name");
            if (itemsError) throw itemsError;
            itemsRes = items || [];
          }
          setProducts(itemsRes);
          setProductQuantities(qtyMap);
        }
      } else {
        setProducts([]);
        setProductQuantities({});
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
      transaction_number: "",
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

    if (!selectedWarehouseId) {
      toast.error("Select a POS warehouse first");
      return;
    }

    if (!paymentData.payment_method) {
      toast.error("Please select a payment method");
      return;
    }

    try {
      const totals = calculateTotals();
      const saleNumber = generateSaleNumber();

      // Determine a location from selected warehouse when possible
      const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);
      const inferredLocationId = selectedWh?.location_id || null;

      // Build invoice payload compatible with Supabase or mock fallback
      const invoicePayload: any = {
        invoice_number: saleNumber,
        customer_id: selectedCustomer?.id || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        status: "sent",
        notes: (paymentData.notes || paymentData.transaction_number)
          ? `${paymentData.notes || ""}${paymentData.notes && paymentData.transaction_number ? "\n" : ""}${paymentData.transaction_number ? `Transaction #: ${paymentData.transaction_number}` : ""}`
          : null,
        location_id: inferredLocationId,
      };

      const invoiceItems = cart.map((line) => ({
        description: line.product.name,
        quantity: line.quantity,
        unit_price: line.product.selling_price,
        total_price: line.total,
        product_id: line.product.id,
        service_id: null,
        staff_id: null,
        location_id: inferredLocationId,
      }));

      // Create an invoice (or fallback receipt) with items
      const invoice = await createInvoiceWithFallback(supabase, invoicePayload, invoiceItems);

      // Decrease inventory at selected warehouse
      try {
        for (const line of cart) {
          const itemId = line.product.id;
          const qty = Number(line.quantity || 0);
          if (!qty) continue;
          const { data: levelRows, error: levelErr } = await supabase
            .from("inventory_levels")
            .select("id, quantity")
            .eq("item_id", itemId)
            .eq("warehouse_id", selectedWarehouseId)
            .limit(1);
          if (levelErr) throw levelErr;
          const existing = (levelRows || [])[0] as { id: string; quantity: number } | undefined;
          if (existing) {
            const available = Number(existing.quantity || 0);
            if (available + 1e-9 < qty) throw new Error("Insufficient stock at selected warehouse");
            const newQty = Math.max(0, available - qty);
            await supabase.from("inventory_levels").update({ quantity: newQty }).eq("id", existing.id);
          } else {
            throw new Error("Item not available at selected warehouse");
          }
          // Post COGS for this line based on product cost_price
          try {
            if (organization?.id) {
              const unitCost = Number(line.product.cost_price || 0);
              if (unitCost > 0) {
                await postSaleCOGSAndInventory({
                  organizationId: organization.id,
                  productId: itemId,
                  quantity: qty,
                  unitCost,
                  locationId: inferredLocationId,
                  referenceId: invoice.id,
                });
              }
            }
          } catch (cogsErr) {
            console.warn("COGS posting failed", cogsErr);
          }
        }
      } catch (invErr) {
        console.warn("Inventory decrement after sale failed:", invErr);
      }

      // Record payment against invoice and post to ledger - Mark as PAID status
      try {
        // Map UI method labels to normalized methods
        const methodLabel = String(paymentData.payment_method || "").toLowerCase();
        const method = methodLabel.includes("cash")
          ? "cash"
          : methodLabel.includes("card")
          ? "card"
          : methodLabel.includes("bank")
          ? "bank_transfer"
          : methodLabel.includes("mobile") || methodLabel.includes("mpesa")
          ? "mpesa"
          : "other";

        await recordInvoicePaymentWithFallback(supabase, {
          invoice_id: invoice.id,
          amount: totals.total,
          method,
          reference_number: paymentData.transaction_number || null,
          payment_date: new Date().toISOString().slice(0, 10),
          location_id: inferredLocationId || null,
        });

        // Update invoice status to paid
        await supabase
          .from('invoices')
          .update({ status: 'paid' })
          .eq('id', invoice.id);

        try {
          if (organization?.id) {
            await postInvoicePaymentToLedger({
              organizationId: organization.id,
              amount: totals.total,
              method,
              invoiceId: invoice.id,
              invoiceNumber: saleNumber,
              paymentDate: new Date().toISOString().slice(0, 10),
              locationId: inferredLocationId || null,
            });
          }
        } catch (ledgerPayErr) {
          console.warn("Invoice payment ledger posting failed", ledgerPayErr);
        }
      } catch (payErr) {
        console.warn("Recording POS payment failed", payErr);
      }

      // Previous revenue ledger posting removed to avoid double-counting when using invoice + payment

      setCurrentSale({
        id: invoice.id,
        sale_number: saleNumber,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.full_name || "Walk-in Customer",
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: totals.globalDiscount,
        total_amount: totals.total,
        payment_method: paymentData.payment_method,
        status: "completed",
        notes: invoicePayload.notes,
        created_at: new Date().toISOString(),
      } as any);
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
            <div className="flex items-center gap-3">
              <Label>Warehouse</Label>
              <Select value={selectedWarehouseId || "__none__"} onValueChange={(v) => setSelectedWarehouseId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select —</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {(!selectedWarehouseId && !loading) ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">Select a warehouse to start selling</div>
            ) : loading ? (
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
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    (productQuantities[product.id] || 0) === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''
                  }`}
                  onClick={() => {
                    if ((productQuantities[product.id] || 0) > 0) {
                      addToCart(product);
                    } else {
                      toast.error("Product is out of stock");
                    }
                  }}
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
                        <span className="text-xs text-muted-foreground">Qty available: {productQuantities[product.id] ?? 0}</span>
                      </div>
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
                  <span>{formatMoney(totals.subtotal)}</span>
                </div>
                {totals.globalDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({paymentData.discount_percentage}%):</span>
                    <span>-{formatMoney(totals.globalDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Tax ({applyTax ? paymentData.tax_percentage : 0}%):
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                    <span>{formatMoney(totals.taxAmount)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatMoney(totals.total)}</span>
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

                    {(paymentData.payment_method === "Mobile money" || paymentData.payment_method === "Mobile Payment") && (
                      <div>
                        <Label htmlFor="transaction_number">Transaction Number</Label>
                        <Input
                          id="transaction_number"
                          type="text"
                          value={paymentData.transaction_number}
                          onChange={(e) => setPaymentData({ ...paymentData, transaction_number: e.target.value })}
                          placeholder="e.g. M-Pesa/Mobile money ref"
                        />
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
                          <span>{formatMoney(totals.subtotal)}</span>
                        </div>
                        {totals.globalDiscount > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Discount:</span>
                            <span>-{formatMoney(totals.globalDiscount)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            Tax:
                          </span>
                          <div className="flex items-center gap-2">
                            <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                            <span>{formatMoney(totals.taxAmount)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-1">
                          <span>Total:</span>
                          <span>{formatMoney(totals.total)}</span>
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
                <h3 className="text-lg font-semibold">{appName}</h3>
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
                    <span>-{formatMoney(currentSale.discount_amount)}</span>
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