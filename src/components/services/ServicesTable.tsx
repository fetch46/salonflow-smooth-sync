import React from "react";
import {
  Table as UITable,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Edit2, Trash2, Star, Users, Eye, MoreVertical } from "lucide-react";

type ServiceLite = {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  category?: string;
  is_active: boolean;
  avg_rating?: number;
  total_bookings?: number;
};

interface ServicesTableProps {
  services: ServiceLite[];
  onView: (service: ServiceLite) => void;
  onEdit: (service: ServiceLite) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, current: boolean) => void;
  formatPrice: (n: number) => string;
  formatDuration: (n: number) => string;
}

const ServicesTable: React.FC<ServicesTableProps> = ({
  services,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  formatPrice,
  formatDuration,
}) => {
  return (
    <UITable>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead>Bookings</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-slate-900">{s.name}</span>
                {s.description && (
                  <span className="text-xs text-slate-500 line-clamp-1">
                    {s.description}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              {s.category ? (
                <Badge variant="outline">{s.category}</Badge>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatPrice(s.price)}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDuration(s.duration_minutes)}
            </TableCell>
            <TableCell>
              {typeof s.avg_rating === "number" ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-500" />
                  {s.avg_rating.toFixed(1)}
                </span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </TableCell>
            <TableCell>
              {typeof s.total_bookings === "number" ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {s.total_bookings}
                </span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.is_active}
                  onCheckedChange={() => onToggleStatus(s.id, s.is_active)}
                />
                <Badge
                  className={
                    s.is_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }
                >
                  {s.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onView(s)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(s)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(s.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableCaption>{services.length} services</TableCaption>
    </UITable>
  );
};

export default ServicesTable;
