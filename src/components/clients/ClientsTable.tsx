import React from "react";
import { Table as UITable, TableHeader, TableRow, TableHead, TableBody, TableCell, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CalendarClock, Edit2, Trash2 } from "lucide-react";

export type ClientRow = {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  client_status?: string;
  total_visits?: number;
  total_spent?: number;
  last_visit_date?: string;
};

interface ClientsTableProps {
  clients: ClientRow[];
  onViewProfile: (id: string) => void;
  onBookAppointment: (c: ClientRow) => void;
  onEdit: (c: ClientRow) => void;
  onDelete: (id: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  formatMoney: (n: number) => string;
  formatLastVisit: (d?: string) => string;
}

const ClientsTable: React.FC<ClientsTableProps> = ({
  clients,
  onViewProfile,
  onBookAppointment,
  onEdit,
  onDelete,
  getStatusBadge,
  formatMoney,
  formatLastVisit,
}) => {
  return (
    <UITable>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Visit</TableHead>
          <TableHead>Visits</TableHead>
          <TableHead>Spent</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.full_name}</TableCell>
            <TableCell>{c.email || <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell>{c.phone || <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell>
              {getStatusBadge(c.client_status || "active")}
            </TableCell>
            <TableCell>{formatLastVisit(c.last_visit_date)}</TableCell>
            <TableCell>{c.total_visits ?? 0}</TableCell>
            <TableCell>{formatMoney(c.total_spent || 0)}</TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onViewProfile(c.id)}>
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onBookAppointment(c)}>
                  <CalendarClock className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(c.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableCaption>{clients.length} clients</TableCaption>
    </UITable>
  );
};

export default ClientsTable;
