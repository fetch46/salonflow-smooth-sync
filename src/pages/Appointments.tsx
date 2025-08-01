import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Appointment {
  id: string;
  customer_name: string;
  service: string;
  technician_id: string;
  date: string;
  time: string;
  status: string;
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    customer_name: "",
    service: "",
    technician_id: "",
    date: "",
    time: "",
    status: "Scheduled",
  });

  const [technicians, setTechnicians] = useState<any[]>([]);

  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("appointments").select("*").order("date", { ascending: true });
    if (error) toast.error("Error fetching appointments");
    else setAppointments(data);
    setLoading(false);
  };

  const fetchTechnicians = async () => {
    const { data, error } = await supabase.from("staff").select("id, full_name");
    if (data) setTechnicians(data);
  };

  useEffect(() => {
    fetchAppointments();
    fetchTechnicians();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("appointments").insert([form]);
    if (error) {
      toast.error("Failed to create appointment");
    } else {
      toast.success("Appointment created!");
      fetchAppointments();
      setForm({ customer_name: "", service: "", technician_id: "", date: "", time: "", status: "Scheduled" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Customer Name</Label>
              <Input name="customer_name" value={form.customer_name} onChange={handleChange} required />
            </div>
            <div>
              <Label>Service</Label>
              <Input name="service" value={form.service} onChange={handleChange} required />
            </div>
            <div>
              <Label>Technician</Label>
              <Select value={form.technician_id} onValueChange={(value) => setForm({ ...form, technician_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" name="time" value={form.time} onChange={handleChange} required />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full">Create Appointment</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Customer</th>
                  <th className="py-2 text-left">Service</th>
                  <th className="py-2 text-left">Technician</th>
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-left">Time</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id} className="border-b">
                    <td className="py-2">{appt.customer_name}</td>
                    <td className="py-2">{appt.service}</td>
                    <td className="py-2">{technicians.find((t) => t.id === appt.technician_id)?.full_name || "N/A"}</td>
                    <td className="py-2">{appt.date}</td>
                    <td className="py-2">{appt.time}</td>
                    <td className="py-2">{appt.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
