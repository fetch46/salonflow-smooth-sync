"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { format } from "date-fns";

// Replace with actual user role logic
const currentUserRole = "admin"; // or "staff"

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [modalInvoice, setModalInvoice] = useState<any | null>(null);

  const pageSize = 5;

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setInvoices(data);
      setFilteredInvoices(data);
    }
  };

  useEffect(() => {
    filterInvoices();
  }, [statusFilter, dateFilter, invoices]);

  const filterInvoices = () => {
    let filtered = [...invoices];
    if (statusFilter !== "all") filtered = filtered.filter(i => i.status === statusFilter);
    if (dateFilter) filtered = filtered.filter(i => format(new Date(i.created_at), "yyyy-MM-dd") === dateFilter);
    setFilteredInvoices(filtered);
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      ["Invoice No,Client,Amount,Status,Date"].concat(
        filteredInvoices.map(i =>
          `${i.invoice_number},${i.client_name},${i.total},${i.status},${i.created_at}`
        )
      ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "invoices.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Total Invoices</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{invoices.length}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Paid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{invoices.filter(i => i.status === "paid").length}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Unpaid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{invoices.filter(i => i.status === "unpaid").length}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-between gap-4 items-end">
        <div className="flex gap-4 flex-wrap">
          <div>
            <Label>Status</Label>
            <Select defaultValue="all" onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-[150px]" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">Export CSV</Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.invoice_number}</TableCell>
                  <TableCell>{inv.client_name}</TableCell>
                  <TableCell>KES {Number(inv.total).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "paid" ? "default" : "destructive"}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(inv.created_at), "PPP")}</TableCell>
                  <TableCell className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setModalInvoice(inv)}>View</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Invoice Details</DialogTitle></DialogHeader>
                        <div>
                          <p><strong>Client:</strong> {inv.client_name}</p>
                          <p><strong>Invoice #:</strong> {inv.invoice_number}</p>
                          <p><strong>Total:</strong> KES {inv.total}</p>
                          <p><strong>Status:</strong> {inv.status}</p>
                          <p><strong>Date:</strong> {format(new Date(inv.created_at), "PPP")}</p>
                        </div>
                        {currentUserRole === "admin" && (
                          <DialogFooter>
                            <Button>Edit</Button>
                          </DialogFooter>
                        )}
                      </DialogContent>
                    </Dialog>

                    {currentUserRole === "admin" && (
                      <Button size="sm" variant="destructive">Delete</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {paginatedInvoices.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6">No invoices found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
          <span>Page {currentPage} of {totalPages}</span>
          <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
        </div>
      )}
    </div>
  );
}
