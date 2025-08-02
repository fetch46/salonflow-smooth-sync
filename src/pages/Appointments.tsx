import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CalendarDays, Edit2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Appointment = {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  staff_id: number;
  status: string;
  price: number;
};

type Staff = {
  id: number;
  full_name: string;
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Appointment>>({});

  const fetchAppointments = async () => {
    // Replace with your data fetching logic
    const data: Appointment[] = []; // Fetch from your backend
    setAppointments(data);
  };

  const fetchStaff = async () => {
    // Replace with your data fetching logic
    const data: Staff[] = []; // Fetch from your backend
    setStaff(data);
  };

  useEffect(() => {
    fetchAppointments();
    fetchStaff();
  }, []);

  const handleChange = (field: keyof Appointment, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Add or update logic
    if (form.id) {
      // Update
    } else {
      // Create
    }
    setIsModalOpen(false);
    resetForm();
    fetchAppointments();
  };

  const handleEdit = (appointment: Appointment) => {
    setForm(appointment);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    // Delete logic
    fetchAppointments();
  };

  const resetForm = () => {
    setForm({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-primary/10 text-primary";
      case "confirmed":
        return "bg-green-100 text-green-600";
      case "in_progress":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "cancelled":
        return "bg-red-100 text-red-600";
      case "no_show":
        return "bg-gray-200 text-gray-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6 w-full max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Appointments</h1>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
          + New Appointment
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"].map((status) => {
          const count = appointments.filter((a) => a.status === status).length;
          const label = status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
          return (
            <Card key={status}>
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold">{count}</div>
                <p className="text-sm text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {appointments.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No appointments found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
              >
                Create your first appointment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => {
                  const staffMember = staff.find((s) => s.id === appointment.staff_id);
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        {appointment.customer_name}
                        <div className="text-xs text-muted-foreground">{appointment.customer_email}</div>
                        <div className="text-xs text-muted-foreground">{appointment.customer_phone}</div>
                      </TableCell>
                      <TableCell>{appointment.service_name}</TableCell>
                      <TableCell>{appointment.appointment_date}</TableCell>
                      <TableCell>
                        {appointment.appointment_time} ({appointment.duration_minutes} min)
                      </TableCell>
                      <TableCell>{staffMember?.full_name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(appointment.status)}>
                          {appointment.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>${appointment.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(appointment)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(appointment.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit" : "New"} Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Customer Name</Label>
                <Input value={form.customer_name || ""} onChange={(e) => handleChange("customer_name", e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.customer_email || ""} onChange={(e) => handleChange("customer_email", e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.customer_phone || ""} onChange={(e) => handleChange("customer_phone", e.target.value)} />
              </div>
              <div>
                <Label>Service Name</Label>
                <Input value={form.service_name || ""} onChange={(e) => handleChange("service_name", e.target.value)} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.appointment_date || ""} onChange={(e) => handleChange("appointment_date", e.target.value)} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={form.appointment_time || ""} onChange={(e) => handleChange("appointment_time", e.target.value)} />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input type="number" value={form.duration_minutes || ""} onChange={(e) => handleChange("duration_minutes", parseInt(e.target.value))} />
              </div>
              <div>
                <Label>Staff</Label>
                <select
                  className="w-full rounded border p-2"
                  value={form.staff_id || ""}
                  onChange={(e) => handleChange("staff_id", parseInt(e.target.value))}
                >
                  <option value="">Select Staff</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full rounded border p-2"
                  value={form.status || ""}
                  onChange={(e) => handleChange("status", e.target.value)}
                >
                  <option value="">Select Status</option>
                  {["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"].map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Price</Label>
                <Input type="number" value={form.price || ""} onChange={(e) => handleChange("price", parseFloat(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit}>
              {form.id ? "Update" : "Create"} Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
