import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { format } from "date-fns";
import { Mail, Phone, MapPin, Calendar, User, Receipt, ClipboardList, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getReceiptsWithFallback, getAllReceiptPaymentsWithFallback } from "@/utils/mockDatabase";

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  is_active: boolean;
  client_status: string;
  preferred_technician_id: string;
  total_spent: number;
  total_visits: number;
  last_visit_date: string;
  created_at: string;
  updated_at: string;
  preferred_technician?: { full_name: string };
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  status: string;
}

interface JobCard {
  id: string;
  job_number: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  staff: { full_name: string } | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  service_name: string;
  status: string;
  price: number;
  staff: { full_name: string } | null;
}

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [paymentsTotal, setPaymentsTotal] = useState<number>(0);

  const fetchClientData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch client details
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select(`
          *,
          preferred_technician:preferred_technician_id (full_name)
        `)
        .eq("id", id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);
      
      // Set edit form data
      setEditForm({
        full_name: clientData.full_name || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address || '',
        notes: clientData.notes || '',
      });

      // Fetch receipts for this client (with Supabase -> mock fallback)
      let receiptsData: any[] = [];
      try {
        const rcptRes = await supabase
          .from("receipts")
          .select("id, receipt_number, total_amount, amount_paid, status, created_at, customer_id")
          .eq("customer_id", id)
          .order("created_at", { ascending: false });
        if (rcptRes.error) throw rcptRes.error;
        receiptsData = rcptRes.data || [];
      } catch (err) {
        const all = await getReceiptsWithFallback(supabase as any);
        receiptsData = (all || []).filter((r: any) => r.customer_id === id);
      }
      setReceipts(receiptsData);

      // Compute total payments received for this client's receipts
      try {
        const allPayments = await getAllReceiptPaymentsWithFallback(supabase);
        const receiptIds = new Set((receiptsData || []).map((r: any) => r.id));
        const totalPayments = (allPayments || [])
          .filter((p: any) => receiptIds.has(p.receipt_id))
          .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
        setPaymentsTotal(totalPayments);
      } catch (payErr) {
        console.warn('Failed to compute payments total', payErr);
        setPaymentsTotal(0);
      }

      // Fetch job cards
      const { data: jobCardsData, error: jobCardsError } = await supabase
        .from("job_cards")
        .select(`
          id, job_number, start_time, end_time, status, total_amount,
          staff:staff_id (full_name)
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      if (jobCardsError) throw jobCardsError;
      setJobCards((jobCardsData || []).map(jc => ({
        ...jc,
        staff: Array.isArray(jc.staff) ? jc.staff[0] || null : jc.staff
      })));

      // Fetch appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, appointment_time, service_name, status, price,
          staff:staff_id (full_name)
        `)
        .eq("client_id", id)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });

      if (appointmentsError) throw appointmentsError;
      setAppointments((appointmentsData || []).map(app => ({
        ...app,
        staff: Array.isArray(app.staff) ? app.staff[0] || null : app.staff
      })));

    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchClientData();
    }
  }, [id, fetchClientData]);

  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-green-100 text-green-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      scheduled: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const visitsCompleted = appointments.filter(a => a.status === 'completed').length;
  const upcomingAppointments = appointments.filter(a => a.status === 'scheduled').length;
  const revenuePaid = Number(paymentsTotal || 0);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to original values
    if (client) {
      setEditForm({
        full_name: client.full_name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
          notes: editForm.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Client updated successfully');
      setIsEditing(false);
      fetchClientData(); // Refresh data
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading client profile...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground">Client not found</h2>
          <p className="text-muted-foreground">The requested client profile could not be found.</p>
        </div>
      </div>
    );
  }

  return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        {/* Client Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
                             <div className="flex-1">
                 {isEditing ? (
                   <Input
                     value={editForm.full_name}
                     onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                     className="text-3xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                     style={{
                       background: 'linear-gradient(to right, rgb(219 39 119), rgb(147 51 234))',
                       WebkitBackgroundClip: 'text',
                       WebkitTextFillColor: 'transparent',
                       backgroundClip: 'text'
                     }}
                   />
                 ) : (
                   <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                     {client.full_name}
                   </h1>
                 )}
                 <p className="text-muted-foreground text-lg">
                   Client since {format(new Date(client.created_at), "MMMM yyyy")}
                 </p>
                 <div className="flex items-center gap-4 mt-2">
                   {client.last_visit_date && (
                     <p className="text-sm text-muted-foreground">
                       Last visit: {format(new Date(client.last_visit_date), "MMM dd, yyyy")}
                     </p>
                   )}
                   {client.preferred_technician && (
                     <p className="text-sm text-muted-foreground">
                       Preferred Technician: {client.preferred_technician.full_name}
                     </p>
                   )}
                 </div>
               </div>
               <div className="flex flex-col items-end space-y-2">
                 <div className="flex gap-2">
                   {isEditing ? (
                     <>
                       <Button size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                         <Save className="w-4 h-4 mr-1" />
                         Save
                       </Button>
                       <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                         <X className="w-4 h-4 mr-1" />
                         Cancel
                       </Button>
                     </>
                   ) : (
                     <Button size="sm" onClick={handleEdit} className="bg-gradient-to-r from-pink-500 to-purple-600">
                       <Edit2 className="w-4 h-4 mr-1" />
                       Edit
                     </Button>
                   )}
                 </div>
                 <div className="flex flex-col space-y-1">
                   {getStatusBadge(client.is_active ? "active" : "inactive")}
                   {client.client_status && getStatusBadge(client.client_status)}
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Details Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Revenue</CardTitle>
              <Receipt className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                ${revenuePaid.toFixed(2)}
              </div>
              <p className="text-xs text-green-600">
                From {receipts.length} sales receipts
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total Visits</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{visitsCompleted}</div>
              <p className="text-xs text-blue-600">
                {upcomingAppointments} upcoming
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Job Cards</CardTitle>
              <ClipboardList className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{jobCards.length}</div>
              <p className="text-xs text-purple-600">
                {jobCards.filter(jc => jc.status === 'completed').length} completed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Sales Receipts</CardTitle>
              <Receipt className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{receipts.length}</div>
              <p className="text-xs text-orange-600">Associated to this client</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-pink-700">Contact</CardTitle>
              <Phone className="h-4 w-4 text-pink-600" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {client.email && (
                  <div className="flex items-center text-xs text-pink-700">
                    <Mail className="w-3 h-3 mr-1" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center text-xs text-pink-700">
                    <Phone className="w-3 h-3 mr-1" />
                    {client.phone}
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center text-xs text-pink-700">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different data views */}
        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList className="justify-start sm:justify-start rounded-xl border bg-card shadow-sm p-2 gap-2 h-auto [&_[role=tab]]:h-12 [&_[role=tab]]:px-4 [&_[role=tab]]:text-base [&_[role=tab]]:gap-2">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="receipts">Sales Receipts</TabsTrigger>
            <TabsTrigger value="jobcards">Job Cards</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appointment History</CardTitle>
                <CardDescription>All appointments for this client</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell>{format(new Date(appointment.appointment_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{appointment.appointment_time}</TableCell>
                        <TableCell>{appointment.service_name}</TableCell>
                        <TableCell>{appointment.staff?.full_name || "N/A"}</TableCell>
                        <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                        <TableCell>${appointment.price?.toFixed(2) || "0.00"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Receipt History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.receipt_number}</TableCell>
                          <TableCell>{format(new Date(r.created_at), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{getStatusBadge(r.status)}</TableCell>
                          <TableCell>${(r.total_amount || 0).toFixed(2)}</TableCell>
                          <TableCell>${(r.amount_paid || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobcards" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Card History</CardTitle>
                <CardDescription>All job cards for this client</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobCards.map((jobCard) => (
                      <TableRow key={jobCard.id}>
                        <TableCell className="font-medium">{jobCard.job_number}</TableCell>
                        <TableCell>
                          {jobCard.start_time ? format(new Date(jobCard.start_time), "MMM dd, yyyy HH:mm") : "N/A"}
                        </TableCell>
                        <TableCell>
                          {jobCard.end_time ? format(new Date(jobCard.end_time), "MMM dd, yyyy HH:mm") : "N/A"}
                        </TableCell>
                        <TableCell>{jobCard.staff?.full_name || "N/A"}</TableCell>
                        <TableCell>{getStatusBadge(jobCard.status)}</TableCell>
                        <TableCell>${jobCard.total_amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Client Details</CardTitle>
                <CardDescription>Complete client information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium">Full Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{client.full_name}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{client.email || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{client.phone || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <p className="text-sm text-muted-foreground mt-1">{client.is_active ? "Active" : "Inactive"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium">Address</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.address}
                        onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{client.address || "N/A"}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium">Notes</Label>
                    {isEditing ? (
                      <Textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        className="mt-1 min-h-[80px]"
                        placeholder="Add notes about this client..."
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{client.notes || "No notes available"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Created</Label>
                    <p className="text-sm text-muted-foreground mt-1">{format(new Date(client.created_at), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Last Updated</Label>
                    <p className="text-sm text-muted-foreground mt-1">{format(new Date(client.updated_at), "MMM dd, yyyy")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}