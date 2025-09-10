import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Calendar,
  Wrench,
  Package,
  FileText,
  Receipt
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";

export default function JobCardView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [jobCard, setJobCard] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchJobCardDetails();
    }
  }, [id]);

  const fetchJobCardDetails = async () => {
    try {
      setLoading(true);

      // Fetch job card details
      const { data: jobCardData, error: jobCardError } = await supabase
        .from("job_cards")
        .select(`
          *,
          clients:client_id (
            id, full_name, email, phone, address
          ),
          staff:staff_id (
            id, full_name, email, phone
          ),
          business_locations:location_id (
            id, name, address, phone
          )
        `)
        .eq("id", id)
        .single();

      if (jobCardError) throw jobCardError;
      setJobCard(jobCardData);

      // Fetch job card services
      const { data: servicesData } = await supabase
        .from("job_card_services")
        .select(`
          *,
          services:service_id ( id, name, price, description ),
          staff:staff_id ( id, full_name )
        `)
        .eq("job_card_id", id);
      setServices(servicesData || []);

      // Fetch job card products
      const { data: productsData } = await supabase
        .from("job_card_products")
        .select(`
          id, inventory_item_id, quantity_used, unit_cost, total_cost,
          inventory_items:inventory_item_id ( id, name, unit )
        `)
        .eq("job_card_id", id);
      setProducts(productsData || []);

      // Load associated invoice
      try {
        const invById = await supabase
          .from('invoices')
          .select('*')
          .eq('jobcard_id', id)
          .maybeSingle();
        
        let found = invById.data;

        if (!found) {
          const invByRef = await supabase
            .from('invoices')
            .select('*')
            .eq('jobcard_reference', id)
            .maybeSingle();
          
          found = invByRef.data;
        }
        
        setInvoice(found);
      } catch (invoiceError) {
        console.error("Error loading invoice:", invoiceError);
      }

    } catch (error: any) {
      console.error("Error fetching job card:", error);
      toast.error(error.message || "Failed to load job card details");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'in_progress':
        return Clock;
      case 'pending':
        return AlertCircle;
      case 'cancelled':
        return XCircle;
      default:
        return Clock;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Loading Job Card..." 
          subtitle="Please wait while we fetch the details"
        />
        <div className="grid gap-6">
          <div className="h-48 bg-gray-100 animate-pulse rounded-lg"></div>
          <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Card Not Found" subtitle="The requested job card could not be found" />
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500 mb-4">This job card may have been deleted or the ID is invalid.</p>
            <Button onClick={() => navigate('/job-cards')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Job Cards
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(jobCard.status);

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Job Card ${jobCard.job_number || jobCard.id}`}
        subtitle={`Created ${format(new Date(jobCard.created_at), 'PPP')}`}
      />

      {/* Header Section */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => navigate('/job-cards')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job Cards
        </Button>
        
        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className={`px-3 py-1 border ${getStatusColor(jobCard.status)}`}
          >
            <StatusIcon className="w-3 h-3 mr-1" />
            {jobCard.status.replace('_', ' ').toUpperCase()}
          </Badge>
          
          <Button 
            onClick={() => navigate(`/job-cards/${id}/edit`)}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Job Card
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Client Information */}
            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-3">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg">Client Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {jobCard.clients ? (
                  <>
                    <div>
                      <p className="font-medium text-gray-900">{jobCard.clients.full_name}</p>
                    </div>
                    {jobCard.clients.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-2" />
                        {jobCard.clients.email}
                      </div>
                    )}
                    {jobCard.clients.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        {jobCard.clients.phone}
                      </div>
                    )}
                    {jobCard.clients.address && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2" />
                        {jobCard.clients.address}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">No client information available</p>
                )}
              </CardContent>
            </Card>

            {/* Job Details */}
            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-3">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-5 h-5 text-green-600" />
                  <CardTitle className="text-lg">Job Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Job Number</p>
                    <p className="font-medium">{jobCard.job_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Amount</p>
                    <p className="font-medium text-green-600">{formatCurrency(jobCard.total_amount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Start Time</p>
                    <p className="font-medium">
                      {jobCard.start_time ? format(new Date(jobCard.start_time), 'PPp') : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">End Time</p>
                    <p className="font-medium">
                      {jobCard.end_time ? format(new Date(jobCard.end_time), 'PPp') : 'Not set'}
                    </p>
                  </div>
                </div>
                
                {jobCard.staff && (
                  <div className="pt-2 border-t">
                    <p className="text-gray-500 text-sm">Assigned Staff</p>
                    <p className="font-medium">{jobCard.staff.full_name}</p>
                  </div>
                )}

                {jobCard.business_locations && (
                  <div className="pt-2 border-t">
                    <p className="text-gray-500 text-sm">Location</p>
                    <p className="font-medium">{jobCard.business_locations.name}</p>
                  </div>
                )}

                {jobCard.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-gray-500 text-sm">Notes</p>
                    <p className="text-sm">{jobCard.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-3">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-lg">Services Performed</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {services.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Commission %</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{service.services?.name || 'Unknown Service'}</p>
                            {service.notes && (
                              <p className="text-sm text-gray-500">{service.notes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {service.staff?.full_name || 'Unassigned'}
                        </TableCell>
                        <TableCell>{service.quantity || 1}</TableCell>
                        <TableCell>{formatCurrency(service.unit_price || 0)}</TableCell>
                        <TableCell>{service.commission_percentage || 0}%</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency((service.quantity || 1) * (service.unit_price || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No services recorded for this job card</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-orange-600" />
                <CardTitle className="text-lg">Products Used</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {products.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity Used</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.inventory_items?.name || 'Unknown Product'}</p>
                            <p className="text-sm text-gray-500">
                              Unit: {product.inventory_items?.unit || 'Each'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{product.quantity_used || 0}</TableCell>
                        <TableCell>{formatCurrency(product.unit_cost || 0)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.total_cost || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No products used for this job card</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-lg">Invoice Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {invoice ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Invoice Number</p>
                      <p className="font-medium">{invoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <Badge variant="outline" className="mt-1">
                        {invoice.status?.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Amount</p>
                      <p className="font-medium text-green-600">{formatCurrency(invoice.total_amount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Due Date</p>
                      <p className="font-medium">
                        {invoice.due_date ? format(new Date(invoice.due_date), 'PPP') : 'Not set'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                      variant="outline"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Invoice
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="mb-3">No invoice has been created for this job card</p>
                  <Button 
                    onClick={() => navigate(`/invoices/new?fromJobCard=${id}`)}
                    className="flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Create Invoice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}