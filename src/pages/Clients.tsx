import React, { useState, useEffect } from "react"; import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Textarea } from "@/components/ui/textarea"; import { Label } from "@/components/ui/label"; import { Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, Users, UserPlus, UserX } from "lucide-react"; import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; import { Badge } from "@/components/ui/badge"; import { supabase } from "@/integrations/supabase/client"; import { useToast } from "@/hooks/use-toast";

interface Client { id: string; full_name: string; email?: string; phone?: string; address?: string; notes?: string; is_active: boolean; created_at: string; updated_at: string; }

export default function Clients() { const [clients, setClients] = useState<Client[]>([]); const [searchTerm, setSearchTerm] = useState(""); const [isModalOpen, setIsModalOpen] = useState(false); const [editingClient, setEditingClient] = useState<Client | null>(null); const [loading, setLoading] = useState(true); const { toast } = useToast();

const [formData, setFormData] = useState({ full_name: "", email: "", phone: "", address: "", notes: "", is_active: true, });

useEffect(() => { fetchClients(); }, []);

const fetchClients = async () => { try { const { data, error } = await supabase .from("clients") .select("*") .order("created_at", { ascending: false });

if (error) throw error;
  setClients(data || []);
} catch (error) {
  console.error("Error fetching clients:", error);
  toast({
    title: "Error",
    description: "Failed to fetch clients",
    variant: "destructive",
  });
} finally {
  setLoading(false);
}

};

const handleSubmit = async (e: React.FormEvent) => { e.preventDefault();

try {
  if (editingClient) {
    const { error } = await supabase
      .from("clients")
      .update(formData)
      .eq("id", editingClient.id);

    if (error) throw error;

    toast({
      title: "Success",
      description: "Client updated successfully",
    });
  } else {
    const { error } = await supabase.from("clients").insert([formData]);

    if (error) throw error;

    toast({
      title: "Success",
      description: "Client created successfully",
    });
  }

  fetchClients();
  resetForm();
  setIsModalOpen(false);
} catch (error) {
  console.error("Error saving client:", error);
  toast({
    title: "Error",
    description: "Failed to save client",
    variant: "destructive",
  });
}

};

const resetForm = () => { setFormData({ full_name: "", email: "", phone: "", address: "", notes: "", is_active: true, }); setEditingClient(null); };

const handleEdit = (client: Client) => { setFormData({ full_name: client.full_name, email: client.email || "", phone: client.phone || "", address: client.address || "", notes: client.notes || "", is_active: client.is_active, }); setEditingClient(client); setIsModalOpen(true); };

const handleDelete = async (id: string) => { if (confirm("Are you sure you want to delete this client?")) { try { const { error } = await supabase.from("clients").delete().eq("id", id);

if (error) throw error;

    toast({
      title: "Success",
      description: "Client deleted successfully",
    });
    fetchClients();
  } catch (error) {
    console.error("Error deleting client:", error);
    toast({
      title: "Error",
      description: "Failed to delete client",
      variant: "destructive",
    });
  }
}

};

const filteredClients = clients.filter( (client) => client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || client.email?.toLowerCase().includes(searchTerm.toLowerCase()) || client.phone?.includes(searchTerm) );

const totalClients = clients.length; const activeClients = clients.filter((c) => c.is_active).length; const inactiveClients = totalClients - activeClients;

if (loading) { return ( <div className="p-6"> <div className="text-center">Loading clients...</div> </div> ); }

return ( <div className="p-6 space-y-6"> <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"> <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Total Clients</CardTitle> <Users className="w-5 h-5 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{totalClients}</div> </CardContent> </Card> <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Active Clients</CardTitle> <UserPlus className="w-5 h-5 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{activeClients}</div> </CardContent> </Card> <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Inactive Clients</CardTitle> <UserX className="w-5 h-5 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{inactiveClients}</div> </CardContent> </Card> </div>

<div className="flex justify-between items-center">
    <h1 className="text-3xl font-bold">Client Management</h1>
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button onClick={resetForm}>
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full Name *</Label>
            <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingClient ? "Update" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </div>

  <div className="relative max-w-sm mb-6">
    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    <Input placeholder="Search clients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
  </div>

  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {filteredClients.map((client) => (
      <Card key={client.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{client.full_name}</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(client)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(client.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Badge variant={client.is_active ? "default" : "secondary"}>{client.is_active ? "Active" : "Inactive"}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {client.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="line-clamp-2">{client.address}</span>
            </div>
          )}
          {client.notes && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground line-clamp-3">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    ))}
  </div>

  {filteredClients.length === 0 && (
    <div className="text-center py-12">
      <p className="text-muted-foreground">No clients found</p>
    </div>
  )}
</div>

); }

