import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ServiceCategory {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

interface ServiceCategoriesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onChanged?: () => void;
}

export default function ServiceCategoriesManager({ open, onOpenChange, organizationId, onChanged }: ServiceCategoriesManagerProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const fetchCategories = async () => {
    try {
      if (!organizationId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, name, description, is_active")
        .eq("organization_id", organizationId)
        .order("name");
      if (error) throw error;
      setCategories(data || []);
    } catch (e: any) {
      console.warn("Failed to load service categories", e?.message || e);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchCategories();
  }, [open]);

  const handleCreate = async () => {
    try {
      if (!newName.trim()) {
        toast.error("Category name is required");
        return;
      }
      setLoading(true);
      const { error } = await supabase
        .from("service_categories")
        .insert([{ name: newName.trim(), description: newDescription || null, organization_id: organizationId }]);
      if (error) throw error;
      toast.success("Category created");
      setNewName("");
      setNewDescription("");
      await fetchCategories();
      onChanged?.();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/duplicate key/i.test(msg) || /unique/i.test(msg)) {
        toast.error("A category with this name already exists");
      } else {
        toast.error("Failed to create category");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (cat: ServiceCategory, newCatName: string) => {
    try {
      const trimmed = newCatName.trim();
      if (!trimmed || trimmed === cat.name) return;
      setLoading(true);
      // Update services referencing this category to keep them in sync
      const { error: svcErr } = await supabase
        .from("services")
        .update({ category: trimmed })
        .eq("organization_id", organizationId)
        .eq("category", cat.name);
      if (svcErr) throw svcErr;
      // Update the category record
      const { error } = await supabase
        .from("service_categories")
        .update({ name: trimmed })
        .eq("id", cat.id);
      if (error) throw error;
      toast.success("Category renamed");
      await fetchCategories();
      onChanged?.();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/duplicate key/i.test(msg) || /unique/i.test(msg)) {
        toast.error("A category with this name already exists");
      } else {
        toast.error("Failed to rename category");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cat: ServiceCategory) => {
    try {
      setLoading(true);
      const { count, error: cntErr } = await supabase
        .from("services")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .eq("category", cat.name);
      if (cntErr) throw cntErr;
      if ((count || 0) > 0) {
        toast.error("Cannot delete: category is used by existing services");
        return;
      }
      const { error } = await supabase
        .from("service_categories")
        .delete()
        .eq("id", cat.id);
      if (error) throw error;
      toast.success("Category deleted");
      await fetchCategories();
      onChanged?.();
    } catch (e: any) {
      toast.error("Failed to delete category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Manage Service Categories</DialogTitle>
          <DialogDescription>
            Create and edit categories for this organization. Names must be unique per organization.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-3">
            <Label htmlFor="new-name">Create Category</Label>
            <Input id="new-name" placeholder="Category name" value={newName} onChange={e => setNewName(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={newDescription} onChange={e => setNewDescription(e.target.value)} />
            <div>
              <Button onClick={handleCreate} disabled={loading}>Add Category</Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Existing Categories</Label>
              <Button variant="outline" size="sm" onClick={fetchCategories} disabled={loading}>Refresh</Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-auto pr-1">
              {categories.length === 0 && (
                <div className="text-sm text-muted-foreground">No categories yet</div>
              )}
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2">
                  <Input defaultValue={cat.name} onBlur={(e) => handleRename(cat, e.target.value)} className="flex-1" />
                  <Button variant="destructive" onClick={() => handleDelete(cat)} disabled={loading}>Delete</Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}