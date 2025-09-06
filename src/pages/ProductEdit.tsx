import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/lib/saas/hooks";

export default function ProductEdit() {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const { organization } = useOrganization();

	const [loading, setLoading] = useState<boolean>(true);
	const [saving, setSaving] = useState<boolean>(false);
	const [formData, setFormData] = useState({
		name: "",
		description: "",
		sku: "",
		unit: "",
		reorder_point: 0,
		cost_price: 0,
		selling_price: 0,
		is_taxable: false,
		sales_account_id: "",
		purchase_account_id: "",
		inventory_account_id: "",
	});

	const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
	const [incomeAccounts, setIncomeAccounts] = useState<any[]>([]);
	const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
	const [assetAccounts, setAssetAccounts] = useState<any[]>([]);
	const [errors, setErrors] = useState<{ sales?: string; purchase?: string; inventory?: string }>({});

	const loadItem = useCallback(async () => {
		if (!id) return;
		try {
			setLoading(true);
			const { data: item, error } = await supabase
				.from("inventory_items")
				.select("id, name, description, sku, unit, reorder_point, cost_price, selling_price")
				.eq("id", id)
				.maybeSingle();
			if (error) throw error;
			if (item) {
				setFormData((prev) => ({
					...prev,
					name: item.name || "",
					description: item.description || "",
					sku: item.sku || "",
					unit: item.unit || "",
					reorder_point: Number(item.reorder_point || 0),
					cost_price: Number(item.cost_price || 0),
					selling_price: Number(item.selling_price || 0),
				}));
			}
		} catch (e) {
			toast({ title: "Error", description: "Failed to load product.", variant: "destructive" });
		} finally {
			setLoading(false);
		}
	}, [id]);

	const loadAccountsAndMapping = useCallback(async () => {
		try {
			setAccountsLoading(true);
			let accs: any[] | null = null;
			let err: any = null;
			try {
				const res = await supabase
					.from("accounts")
					.select("id, account_code, account_name, account_type, account_subtype")
					.eq("organization_id", organization?.id || "");
				accs = res.data as any[] | null;
				err = res.error;
			} catch (innerErr: any) {
				err = innerErr;
			}
			if (err) {
				const message = String(err?.message || "");
				if (message.includes("account_subtype") || (message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist"))) {
					const { data, error } = await supabase
						.from("accounts")
						.select("id, account_code, account_name, account_type")
						.eq("organization_id", organization?.id || "");
					if (error) throw error;
					accs = data as any[] | null;
				} else {
					throw err;
				}
			}
			const accounts = accs || [];
			setIncomeAccounts(accounts.filter((a: any) => a.account_type === 'Income'));
			setExpenseAccounts(accounts.filter((a: any) => a.account_type === 'Expense'));
			setAssetAccounts(accounts.filter((a: any) => a.account_type === 'Asset' && (!('account_subtype' in a) || ['Stock','Stocks'].includes((a as any).account_subtype))));

			if (id) {
				const { data: mapping, error: mapErr } = await supabase
					.from("inventory_item_accounts")
					.select("sales_account_id, purchase_account_id, inventory_account_id, is_taxable")
					.eq("item_id", id)
					.maybeSingle();
				if (!mapErr && mapping) {
					setFormData((prev) => ({
						...prev,
						sales_account_id: mapping.sales_account_id || "",
						purchase_account_id: mapping.purchase_account_id || "",
						inventory_account_id: mapping.inventory_account_id || "",
						is_taxable: !!mapping.is_taxable,
					}));
				}
			}
		} catch (e) {
			// ignore
		} finally {
			setAccountsLoading(false);
		}
	}, [organization?.id, id]);

	useEffect(() => {
		loadItem();
	}, [loadItem]);

	useEffect(() => {
		loadAccountsAndMapping();
	}, [loadAccountsAndMapping]);

	const validateInventoryAccountIsStock = async (inventoryAccountId: string) => {
		try {
			const { data: invAcc } = await supabase
				.from('accounts')
				.select('id, account_type, account_subtype')
				.eq('id', inventoryAccountId)
				.maybeSingle();
			if (!invAcc || invAcc.account_type !== 'Asset' || !(['Stock','Stocks'].includes((invAcc as any).account_subtype))) {
				throw new Error('Inventory account must be an Asset with subtype Stock');
			}
			return true;
		} catch (err) {
			toast({ title: 'Invalid inventory account', description: 'Select an Asset account with subtype Stock', variant: 'destructive' });
			return false;
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!id) return;
		try {
			setSaving(true);
			const nextErrors: { sales?: string; purchase?: string; inventory?: string } = {};
			if (!formData.sales_account_id) nextErrors.sales = "Required";
			if (!formData.purchase_account_id) nextErrors.purchase = "Required";
			if (!formData.inventory_account_id) nextErrors.inventory = "Required";
			setErrors(nextErrors);
			if (nextErrors.sales || nextErrors.purchase || nextErrors.inventory) {
				toast({ title: "Missing accounts", description: "Please select Sales, Purchase, and Inventory accounts.", variant: "destructive" });
				return;
			}

			const ok = await validateInventoryAccountIsStock(formData.inventory_account_id);
			if (!ok) return;

			const payload = {
				name: (formData.name || '').trim(),
				description: formData.description,
				sku: (formData.sku || '').trim() ? (formData.sku || '').trim() : null,
				unit: (formData.unit || '').trim() || null,
				reorder_point: Number(formData.reorder_point || 0),
				cost_price: Number(formData.cost_price || 0),
				selling_price: Number(formData.selling_price || 0),
			};

			const { error } = await supabase
				.from("inventory_items")
				.update(payload)
				.eq("id", id);
			if (error) throw error;

			const mapPayload = {
				item_id: id,
				sales_account_id: formData.sales_account_id || null,
				purchase_account_id: formData.purchase_account_id || null,
				inventory_account_id: formData.inventory_account_id || null,
				is_taxable: !!formData.is_taxable,
			} as const;
			let upsertError: any = null;
			try {
				const res = await supabase.from('inventory_item_accounts').upsert(mapPayload, { onConflict: 'item_id' });
				upsertError = res.error || null;
			} catch (err: any) {
				upsertError = err;
			}
			if (upsertError) {
				const { data: existing } = await supabase
					.from('inventory_item_accounts')
					.select('item_id')
					.eq('item_id', id)
					.maybeSingle();
				if (existing) {
					const { error } = await supabase.from('inventory_item_accounts').update(mapPayload).eq('item_id', id);
					if (error) throw error;
				} else {
					const { error } = await supabase.from('inventory_item_accounts').insert(mapPayload);
					if (error) throw error;
				}
			}

			toast({ title: "Saved", description: "Product updated successfully" });
			navigate(`/inventory/${id}`);
		} catch (err: any) {
			toast({ title: "Error", description: String(err?.message || 'Failed to save product'), variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	const fillCostFromLastPurchase = async () => {
		if (!id) return;
		try {
			const { data, error } = await supabase
				.from("purchase_items")
				.select("unit_cost, created_at")
				.eq("item_id", id)
				.order("created_at", { ascending: false })
				.limit(1);
			if (error) throw error;
			const last = (data || [])[0];
			if (last?.unit_cost != null) {
				setFormData((prev) => ({ ...prev, cost_price: Number(last.unit_cost) }));
			}
		} catch (e) {
			// ignore
		}
	};

	if (loading) {
		return (
			<div className="p-6">
				<p className="text-sm text-muted-foreground">Loading...</p>
			</div>
		);
	}

	return (
		<div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 lg:space-y-8">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold">Edit Product</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Product Details</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
							</div>
							<div className="space-y-2">
								<Label htmlFor="sku">SKU</Label>
								<Input id="sku" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="space-y-2">
								<Label htmlFor="unit">Unit</Label>
								<Input id="unit" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="e.g., piece, bottle, kg" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="reorder-point">Reorder Point</Label>
								<Input id="reorder-point" type="number" value={formData.reorder_point} onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 0 })} />
							</div>
							<div className="space-y-2">
								<Label>Taxable</Label>
								<div className="flex h-10 items-center px-3 rounded-md border">
									<Switch checked={formData.is_taxable} onCheckedChange={(v) => setFormData({ ...formData, is_taxable: v })} />
									<span className="ml-2 text-sm text-muted-foreground">Charge tax when selling this item</span>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="cost_price">Purchase Price</Label>
								<div className="flex gap-2">
									<Input id="cost_price" type="number" step="0.01" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value || '0') })} />
									<Button type="button" variant="outline" onClick={fillCostFromLastPurchase} disabled={!id || saving}>
										Use last purchase
									</Button>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="selling_price">Selling Price</Label>
								<Input id="selling_price" type="number" step="0.01" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value || '0') })} />
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="space-y-2">
								<Label>Sales Account</Label>
								<Select value={formData.sales_account_id} onValueChange={(v) => setFormData({ ...formData, sales_account_id: v })}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select income account'} />
									</SelectTrigger>
									<SelectContent>
										{incomeAccounts.map((a) => (
											<SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
										))}
									</SelectContent>
								</Select>
								{errors.sales && (<p className="text-xs text-destructive">{errors.sales}</p>)}
							</div>
							<div className="space-y-2">
								<Label>Purchase Account</Label>
								<Select value={formData.purchase_account_id} onValueChange={(v) => setFormData({ ...formData, purchase_account_id: v })}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select expense account'} />
									</SelectTrigger>
									<SelectContent>
										{expenseAccounts.map((a) => (
											<SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
										))}
									</SelectContent>
								</Select>
								{errors.purchase && (<p className="text-xs text-destructive">{errors.purchase}</p>)}
							</div>
							<div className="space-y-2">
								<Label>Inventory Account</Label>
								<Select value={formData.inventory_account_id} onValueChange={(v) => setFormData({ ...formData, inventory_account_id: v })}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select asset account (Stock)'} />
									</SelectTrigger>
									<SelectContent>
										{assetAccounts.map((a) => (
											<SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
										))}
									</SelectContent>
								</Select>
								{errors.inventory && (<p className="text-xs text-destructive">{errors.inventory}</p>)}
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => navigate(`/inventory/${id}`)} disabled={saving}>Cancel</Button>
							<Button type="submit" disabled={saving}>Save Changes</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}