import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { JobCardCommissionCalculator } from '@/components/JobCardCommissionCalculator';
import { useSaas } from '@/lib/saas';

const formSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  appointment_id: z.string().optional(),
  staff_id: z.string().optional(),
  notes: z.string().optional(),
  services: z.array(z.object({
    service_id: z.string(),
    staff_id: z.string().optional(),
    quantity: z.number().min(1),
    unit_price: z.number().min(0),
    commission_percentage: z.number().min(0).max(100).optional(),
    duration_minutes: z.number().optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one service is required'),
  products: z.array(z.object({
    inventory_item_id: z.string(),
    quantity_used: z.number().min(0.01),
    unit_cost: z.number().min(0),
  })).optional(),
});

interface EnhancedJobCardFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEditing?: boolean;
}

export const EnhancedJobCardForm: React.FC<EnhancedJobCardFormProps> = ({
  onSubmit,
  initialData,
  isEditing = false,
}) => {
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [showCommissionCalc, setShowCommissionCalc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [defaultLocation, setDefaultLocation] = useState<string>('');
  const { organization } = useSaas();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: '',
      appointment_id: '',
      staff_id: '',
      notes: '',
      services: [],
      products: [],
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (!organization?.id) throw new Error('No active organization');
      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', organization.id);
      setClients(clientsData || []);

      // Fetch staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', organization.id);
      setStaff(staffData || []);

      // Fetch services
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', organization.id);
      setServices(servicesData || []);

      // Fetch inventory items
      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', organization.id);
      setInventoryItems(inventoryData || []);

      // Fetch appointments
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('*')
        .eq('organization_id', organization.id)
        .order('appointment_date', { ascending: false });
      setAppointments(appointmentsData || []);

      // Get default location
      const { data: locationData } = await supabase
        .from('business_locations')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('is_default', true)
        .single();
      
      if (locationData) {
        setDefaultLocation(locationData.id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      if (!organization?.id) throw new Error('No active organization');
      const jobCardData = {
        client_id: values.client_id,
        appointment_id: values.appointment_id || null,
        staff_id: values.staff_id || null,
        notes: values.notes,
        total_amount: calculateTotal(),
        status: 'in_progress',
        organization_id: organization.id,
        job_number: '', // Will be set by trigger
      };

      const { data: jobCard, error: jobCardError } = await supabase
        .from('job_cards')
        .insert(jobCardData)
        .select('*, job_number')
        .single();

      if (jobCardError) throw jobCardError;

      // Insert services
      if (selectedServices.length > 0) {
        const serviceData = selectedServices.map(service => ({
          job_card_id: jobCard.id,
          service_id: service.service_id,
          staff_id: service.staff_id || null,
          quantity: service.quantity,
          unit_price: service.unit_price,
          commission_percentage: service.commission_percentage || 0,
          commission_amount: ((service.unit_price * service.quantity) * (service.commission_percentage || 0)) / 100,
          duration_minutes: service.duration_minutes || null,
          notes: service.notes || null,
        }));

        const { error: servicesError } = await supabase
          .from('job_card_services')
          .insert(serviceData);

        if (servicesError) {
          console.error('Failed to save job card services:', servicesError);
          toast.error('Failed to save job card services: ' + servicesError.message);
          throw servicesError;
        }
      }

      // Insert products and update inventory
      if (selectedProducts.length > 0) {
        const productData = selectedProducts.map(product => ({
          job_card_id: jobCard.id,
          inventory_item_id: product.inventory_item_id,
          quantity_used: product.quantity_used,
          unit_cost: product.unit_cost,
          total_cost: product.quantity_used * product.unit_cost,
        }));

        const { error: productsError } = await supabase
          .from('job_card_products')
          .insert(productData);

        if (productsError) throw productsError;

        // Update inventory levels - now including location_id
        const inventoryUpdates = selectedProducts.map(product => ({
          item_id: product.inventory_item_id,
          location_id: defaultLocation, // Add the missing location_id
          warehouse_id: defaultLocation, // If using warehouse_id as well
          quantity: -product.quantity_used, // Negative because it's being used
        }));

        for (const update of inventoryUpdates) {
          // Check if inventory level exists
          const { data: existing } = await supabase
            .from('inventory_levels')
            .select('*')
            .eq('item_id', update.item_id)
            .eq('location_id', update.location_id)
            .single();

          if (existing) {
            // Update existing
            await supabase
              .from('inventory_levels')
              .update({ quantity: existing.quantity + update.quantity })
              .eq('id', existing.id);
          } else {
            // Create new with initial quantity
            await supabase
              .from('inventory_levels')
              .insert({
                item_id: update.item_id,
                location_id: update.location_id,
                quantity: Math.abs(update.quantity), // Start with positive quantity
              });
          }
        }
      }

      toast.success('Job card created successfully');
      onSubmit(jobCard);
    } catch (error: any) {
      console.error('Error creating job card:', error);
      toast.error('Failed to create job card: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addService = () => {
    setSelectedServices([...selectedServices, {
      id: Date.now().toString(),
      service_id: '',
      staff_id: '',
      quantity: 1,
      unit_price: 0,
      commission_percentage: 0,
      duration_minutes: null,
      notes: '',
    }]);
  };

  const updateService = (index: number, field: string, value: any) => {
    const updated = [...selectedServices];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'service_id') {
      const service = services.find(s => s.id === value);
      if (service) {
        updated[index].unit_price = service.price || 0;
        updated[index].duration_minutes = service.duration_minutes || null;
      }
    }

    setSelectedServices(updated);
  };

  const removeService = (index: number) => {
    setSelectedServices(selectedServices.filter((_, i) => i !== index));
  };

  const addProduct = () => {
    setSelectedProducts([...selectedProducts, {
      id: Date.now().toString(),
      inventory_item_id: '',
      quantity_used: 1,
      unit_cost: 0,
    }]);
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const updated = [...selectedProducts];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'inventory_item_id') {
      const item = inventoryItems.find(i => i.id === value);
      if (item) {
        updated[index].unit_cost = item.cost_price || 0;
      }
    }

    setSelectedProducts(updated);
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const servicesTotal = selectedServices.reduce((sum, service) => 
      sum + (service.quantity * service.unit_price), 0);
    const productsTotal = selectedProducts.reduce((sum, product) => 
      sum + (product.quantity_used * product.unit_cost), 0);
    return servicesTotal + productsTotal;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {isEditing ? 'Edit Job Card' : 'Create New Job Card'}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCommissionCalc(true)}
            >
              <Calculator className="w-4 h-4 mr-2" />
              Commission Calculator
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appointment_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appointment (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Link to appointment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {appointments.map((appointment) => (
                            <SelectItem key={appointment.id} value={appointment.id}>
                              {appointment.customer_name} - {appointment.appointment_date}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="staff_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Staff Member</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {staff.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Services Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Services
                    <Button type="button" onClick={addService} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Service
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedServices.map((service, index) => (
                    <div key={service.id} className="border rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium">Service {index + 1}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeService(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Service</label>
                          <Select
                            value={service.service_id}
                            onValueChange={(value) => updateService(index, 'service_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select service" />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Staff Member</label>
                          <Select
                            value={service.staff_id}
                            onValueChange={(value) => updateService(index, 'staff_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select staff" />
                            </SelectTrigger>
                            <SelectContent>
                              {staff.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Quantity</label>
                          <Input
                            type="number"
                            min="1"
                            value={service.quantity}
                            onChange={(e) => updateService(index, 'quantity', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Unit Price</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={service.unit_price}
                            onChange={(e) => updateService(index, 'unit_price', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Commission %</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={service.commission_percentage}
                            onChange={(e) => updateService(index, 'commission_percentage', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Duration (min)</label>
                          <Input
                            type="number"
                            min="1"
                            value={service.duration_minutes || ''}
                            onChange={(e) => updateService(index, 'duration_minutes', Number(e.target.value) || null)}
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium mb-2">Notes</label>
                        <Textarea
                          value={service.notes}
                          onChange={(e) => updateService(index, 'notes', e.target.value)}
                          placeholder="Service-specific notes..."
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Products Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Products Used
                    <Button type="button" onClick={addProduct} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProducts.map((product, index) => (
                    <div key={product.id} className="border rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium">Product {index + 1}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeProduct(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Product</label>
                          <Select
                            value={product.inventory_item_id}
                            onValueChange={(value) => updateProduct(index, 'inventory_item_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventoryItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Quantity Used</label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={product.quantity_used}
                            onChange={(e) => updateProduct(index, 'quantity_used', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Unit Cost</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={product.unit_cost}
                            onChange={(e) => updateProduct(index, 'unit_cost', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes for this job card..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total Amount:</span>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      ${calculateTotal().toFixed(2)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : (isEditing ? 'Update Job Card' : 'Create Job Card')}
                </Button>
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Reset Form
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showCommissionCalc && selectedServices.length > 0 && (
        <JobCardCommissionCalculator
          serviceId={selectedServices[0]?.service_id}
          staffId={selectedServices[0]?.staff_id}
          amount={selectedServices[0]?.unit_price || 0}
          onCommissionChange={(commission, rate) => {
            console.log('Commission calculated:', commission, rate);
            setShowCommissionCalc(false);
          }}
        />
      )}
    </div>
  );
};
