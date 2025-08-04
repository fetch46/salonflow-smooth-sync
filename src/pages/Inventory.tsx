import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Edit2, Trash2, Eye, MoreVertical } from "lucide-react";

const Services = () => {
  const [services, setServices] = useState([]);
  const [goods, setGoods] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Goods");
  const [price, setPrice] = useState("");
  const [kitItems, setKitItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const savedServices = JSON.parse(localStorage.getItem("services")) || [];
    const savedGoods = JSON.parse(localStorage.getItem("goods")) || [];
    setServices(savedServices);
    setGoods(savedGoods);
  }, []);

  const saveToLocalStorage = (updated) => {
    localStorage.setItem("services", JSON.stringify(updated));
    setServices(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newItem = {
      id: editingId || Date.now(),
      name,
      description,
      type,
      price: parseFloat(price),
      kitItems: type === "Service" ? kitItems : [],
    };

    const updated = editingId
      ? services.map((item) => (item.id === editingId ? newItem : item))
      : [...services, newItem];

    saveToLocalStorage(updated);
    resetForm();
  };

  const handleEdit = (item) => {
    setName(item.name);
    setDescription(item.description);
    setType(item.type);
    setPrice(item.price.toString());
    setKitItems(item.kitItems || []);
    setEditingId(item.id);
  };

  const handleDelete = (id) => {
    const updated = services.filter((item) => item.id !== id);
    saveToLocalStorage(updated);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setType("Goods");
    setPrice("");
    setKitItems([]);
    setEditingId(null);
  };

  const toggleKitItem = (id) => {
    const exists = kitItems.find((item) => item.id === id);
    if (exists) {
      setKitItems(kitItems.filter((item) => item.id !== id));
    } else {
      setKitItems([...kitItems, { id, quantity: 1 }]);
    }
  };

  const updateKitQuantity = (id, quantity) => {
    setKitItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Number(quantity) } : item
      )
    );
  };

  const getKitItemQuantity = (id) => {
    const found = kitItems.find((item) => item.id === id);
    return found ? found.quantity : 1;
  };

  const isKitSelected = (id) => {
    return kitItems.some((item) => item.id === id);
  };

  const filteredServices = services.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const getGoodName = (id) => goods.find((g) => g.id === id)?.name || "Unknown";

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Item" : "Add Item"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(val) => setType(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Goods">Goods</SelectItem>
                    <SelectItem value="Service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            {type === "Service" && (
              <div>
                <Label className="mb-2 block">Select Goods for Kit</Label>
                <div className="space-y-2">
                  {goods.map((good) => (
                    <div key={good.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isKitSelected(good.id)}
                        onChange={() => toggleKitItem(good.id)}
                      />
                      <span className="w-32">{good.name}</span>
                      {isKitSelected(good.id) && (
                        <Input
                          type="number"
                          className="w-24"
                          min={1}
                          value={getKitItemQuantity(good.id)}
                          onChange={(e) => updateKitQuantity(good.id, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="submit">{editingId ? "Update" : "Add"}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Price</th>
                  <th className="text-left p-3">Kit (if service)</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => (
                  <tr key={service.id} className="border-t">
                    <td className="p-3">{service.name}</td>
                    <td className="p-3">{service.type}</td>
                    <td className="p-3">KES {service.price}</td>
                    <td className="p-3">
                      {service.type === "Service" && service.kitItems.length > 0 ? (
                        <ul className="list-disc list-inside text-muted-foreground">
                          {service.kitItems.map((item) => (
                            <li key={item.id}>
                              {getGoodName(item.id)} - {item.quantity}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => alert(JSON.stringify(service, null, 2))}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(service)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(service.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredServices.length === 0 && (
              <p className="text-muted-foreground mt-4">No services found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Services;
