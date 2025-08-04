import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit2,
  Trash2,
  Eye,
  Plus,
  MoreVertical,
  Boxes,
  Layers,
} from "lucide-react";

interface Service {
  id: number;
  name: string;
  description: string;
  type: "service" | "goods";
  reorderPoint?: number;
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"service" | "goods">("service");
  const [reorderPoint, setReorderPoint] = useState<number | undefined>(
    undefined
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "service" | "goods">("all");

  const handleAddOrUpdate = () => {
    if (!name.trim()) return;

    const newService: Service = {
      id: editingId ?? Date.now(),
      name,
      description,
      type,
      reorderPoint: type === "goods" ? reorderPoint ?? 0 : undefined,
    };

    setServices((prev) =>
      editingId
        ? prev.map((s) => (s.id === editingId ? newService : s))
        : [...prev, newService]
    );

    resetForm();
  };

  const handleEdit = (service: Service) => {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description);
    setType(service.type);
    setReorderPoint(service.reorderPoint);
  };

  const handleDelete = (id: number) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setType("service");
    setReorderPoint(undefined);
  };

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || s.type === filter;
      return matchesSearch && matchesFilter;
    });
  }, [services, search, filter]);

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-md border-blue-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Boxes className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md border-green-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Layers className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {services.filter((s) => s.type === "service").length}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md border-yellow-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Goods</CardTitle>
            <Boxes className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {services.filter((s) => s.type === "goods").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Section */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>{editingId ? "Edit" : "Add"} Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(val) => setType(val as "service" | "goods")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="goods">Goods</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "goods" && (
              <div>
                <Label>Reorder Point</Label>
                <Input
                  type="number"
                  value={reorderPoint ?? ""}
                  onChange={(e) => setReorderPoint(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
            <Button onClick={handleAddOrUpdate}>
              {editingId ? "Update" : "Add"} Item
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={(val) => setFilter(val as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="goods">Goods</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border rounded-md">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Reorder Point</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map((service) => (
              <tr key={service.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{service.name}</td>
                <td className="p-3">
                  <Badge variant={service.type === "goods" ? "secondary" : "default"}>
                    {service.type}
                  </Badge>
                </td>
                <td className="p-3">{service.type === "goods" ? service.reorderPoint : "-"}</td>
                <td className="p-3">{service.description}</td>
                <td className="p-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => alert(`Viewing ${service.name}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(service)}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(service.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredServices.length === 0 && (
          <p className="text-center text-muted-foreground py-6">No services found.</p>
        )}
      </div>
    </div>
  );
              }
