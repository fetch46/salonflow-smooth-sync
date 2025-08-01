// src/pages/appointments.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
}

interface Appointment {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  customer: Customer;
  service: Service;
  technician: Staff;
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [technicians, setTechnicians] = useState<Staff[]>([]);

  const [form, setForm] = useState({
    customer_id: "",
    service_id: "",
    technician_id: "",
    booking_date: "",
    start_time: "",
    end_time: "",
    status: "Pending",
    payment_status: "Pending"
  });

  useEffect(() => {
    fetchAppointments();
    fetchData();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(`*,
        customer:customer_id (id, first_name, last_name),
        service:service_id (id, name, duration_minutes),
        technician:technician_id (id, first_name, last_name)`)
      .order("booking_date", { ascending: false });
    if (!error) setAppointments(data);
    setLoading(false);
  };

  const fetchData = async () => {
    const [{ data: customers }, { data: services }, { data: technicians }] = await Promise.all([
      supabase.from("customers").select("id, first_name, last_name"),
      supabase.from("services").select("id, name, duration_minutes"),
      supabase.from("staff").select("id, first_name, last_name")
    ]);
    if (customers) setCustomers(customers);
    if (services) setServices(services);
    if (technicians) setTechnicians(technicians);
  };

  const createAppointment = async () => {
    const { error } = await supabase.from("appointments").insert([form]);
    if (!error) {
      fetchAppointments();
      setForm({
        customer_id: "",
        service_id: "",
        technician_id: "",
        booking_date: "",
        start_time: "",
        end_time: "",
        status: "Pending",
        payment_status: "Pending"
      });
    }
  };

  const filtered = appointments.filter((appt) => {
    const name = `${appt.customer.first_name} ${appt.customer.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Appointments</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Appointment</Button>
          </DialogTrigger>
          <DialogContent>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">New Appointment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer</Label>
                  <Select value={form.customer_id} onValueChange={(val) => setForm({ ...form, customer_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service</Label>
                  <Select value={form.service_id} onValueChange={(val) => setForm({ ...form, service_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Technician</Label>
                  <Select value={form.technician_id} onValueChange={(val) => setForm({ ...form, technician_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                    <SelectContent>
                      {technicians.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} />
                </div>
                <div>
                  <Label>Start Time</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Confirmed">Confirmed</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Select value={form.payment_status} onValueChange={(val) => setForm({ ...form, payment_status: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={createAppointment}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-w-sm">
        <Input placeholder="Search by customer name..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">No appointments found</TableCell>
              </TableRow>
            ) : (
              filtered.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>{appt.customer.first_name} {appt.customer.last_name}</TableCell>
                  <TableCell>{appt.service.name}</TableCell>
                  <TableCell>{appt.technician.first_name} {appt.technician.last_name}</TableCell>
                  <TableCell>{new Date(appt.booking_date).toLocaleDateString()}</TableCell>
                  <TableCell>{appt.start_time} - {appt.end_time}</TableCell>
                  <TableCell>
                    <Badge>{appt.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{appt.payment_status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

