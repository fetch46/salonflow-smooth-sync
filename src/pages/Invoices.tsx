"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { saveAs } from "file-saver";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching invoices:", error.message);
    } else {
      setInvoices(data);
      setFilteredInvoices(data);
    }
  };

  useEffect(() => {
    filterInvoices();
  }, [statusFilter, dateFilter, invoices]);

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (statusFilter !== "all") {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    if (dateFilter) {
      filtered = filtered.filter(inv =>
        format(new Date(inv.created_at), "yyyy-MM-dd") === dateFilter
      );
    }

    setFilteredInvoices(filtered);
  };

  const exportToCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Invoice No,Client,Amount,Status,Created At"]
        .concat(
          filteredInvoices.map(
            (inv) =>
              `${inv.invoice_number},${inv.client_name},${inv.total},${inv.status},${inv.created_at}`
          )
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "invoices.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-full mx-auto space-y-6 px-8 pt-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Invoices</CardTitle>
            <CardDescription>Total number of invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paid</CardTitle>
            <CardDescription>Invoices marked as paid</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.filter(i => i.status === "paid").length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unpaid</CardTitle>
            <CardDescription>Invoices not yet paid</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.filter(i => i.status === "unpaid").length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mt-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <Label>Status</Label>
            <Select onValueChange={(val) => setStatusFilter(val)} defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[160px]"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>Export to CSV</Button>
          {/* PDF export logic can be added using libraries like jsPDF if needed */}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.invoice_number}</TableCell>
                    <TableCell>{inv.client_name}</TableCell>
                    <TableCell>KES {Number(inv.total).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "default" : "destructive"}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(inv.created_at), "PPP")}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
