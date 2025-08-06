import React, { useEffect, useState } from "react"; import { supabase } from "@/integrations/supabase/client"; import { Card, CardContent, CardHeader, CardTitle, } from "@/components/ui/card"; import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog"; import { Label } from "@/components/ui/label"; import { Textarea } from "@/components/ui/textarea"; import { toast } from "sonner"; import { Badge } from "@/components/ui/badge"; import { Trash2, Eye, Edit2 } from "lucide-react";

interface Client { id: string; name: string; contact: string; address: string; notes: string; status: string; created_at: string; }

export default function Clients() { const [clients, setClients] = useState<Client[]>([]); const [filteredClients, setFilteredClients] = useState<Client[]>([]); const [searchQuery, setSearchQuery] = useState(""); const [selectedClient, setSelectedClient] = useState<Client | null>(null); const [form, setForm] = useState({ name: "", contact: "", address: "", notes: "", status: "Active", }); const [modalOpen, setModalOpen] = useState(false); const [deleteModalOpen, setDeleteModalOpen] = useState(false); const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null); const [currentPage, setCurrentPage] = useState(1); const itemsPerPage = 10;

useEffect(() => { fetchClients(); const channel = supabase .channel("realtime clients") .on( "postgres_changes", { event: "*", schema: "public", table: "clients" }, () => fetchClients() ) .subscribe(); return () => { supabase.removeChannel(channel); }; }, []);

const fetchClients = async () => { const { data, error } = await supabase .from("clients") .select("*") .order("created_at", { ascending: false }); if (error) console.error(error); else { setClients(data); setFilteredClients(data); } };

const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => { const value = e.target.value.toLowerCase(); setSearchQuery(value); setFilteredClients( clients.filter((client) => client.name.toLowerCase().includes(value) ) ); setCurrentPage(1); };

const handleSubmit = async () => { const { name, contact, address } = form; if (!name || !contact || !address) { toast("Please fill in all required fields"); return; } if (selectedClient) { await supabase.from("clients").update(form).eq("id", selectedClient.id); toast("Client updated successfully"); } else { await supabase.from("clients").insert([form]); toast("Client created successfully"); } setForm({ name: "", contact: "", address: "", notes: "", status: "Active" }); setSelectedClient(null); setModalOpen(false); };

const openEditModal = (client: Client) => { setSelectedClient(client); setForm({ ...client }); setModalOpen(true); };

const openDeleteModal = (id: string) => { setDeleteTargetId(id); setDeleteModalOpen(true); };

const handleDelete = async () => { if (deleteTargetId) { await supabase.from("clients").delete().eq("id", deleteTargetId); toast("Client deleted successfully"); setDeleteModalOpen(false); } };

const paginatedClients = filteredClients.slice( (currentPage - 1) * itemsPerPage, currentPage * itemsPerPage );

const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

return ( <div className="p-4"> <div className="flex justify-between items-center mb-4"> <h2 className="text-2xl font-bold">Clients</h2> <Dialog open={modalOpen} onOpenChange={setModalOpen}> <DialogTrigger asChild> <Button onClick={() => setSelectedClient(null)}>Add Client</Button> </DialogTrigger> <DialogContent> <DialogHeader> <DialogTitle> {selectedClient ? "Edit Client" : "Add New Client"} </DialogTitle> </DialogHeader> <div className="grid gap-4 py-4"> <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /> <Input placeholder="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /> <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /> <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /> </div> <DialogFooter> <Button onClick={handleSubmit}> {selectedClient ? "Update" : "Save"} </Button> </DialogFooter> </DialogContent> </Dialog> </div>

<Input
    className="mb-4"
    placeholder="Search by name"
    value={searchQuery}
    onChange={handleSearch}
  />

  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
    {paginatedClients.map((client) => (
      <Card key={client.id}>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>{client.name}</span>
            <Badge>{client.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Contact: {client.contact}</p>
          <p className="text-sm">Address: {client.address}</p>
          <p className="text-sm">{client.notes}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={() => alert("Viewing profile")}> <Eye className="w-4 h-4" /></Button>
            <Button variant="outline" onClick={() => openEditModal(client)}><Edit2 className="w-4 h-4" /></Button>
            <Button variant="destructive" onClick={() => openDeleteModal(client.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>

  {/* Pagination Controls */}
  <div className="mt-6 flex justify-center items-center gap-4">
    <Button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
      Previous
    </Button>
    <span>
      Page {currentPage} of {totalPages}
    </span>
    <Button
      disabled={currentPage === totalPages}
      onClick={() => setCurrentPage((p) => p + 1)}
    >
      Next
    </Button>
  </div>

  {/* Delete Confirmation Modal */}
  <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this client? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</div>

); }

