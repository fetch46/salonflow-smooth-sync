-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  service_name TEXT NOT NULL,
  staff_id UUID REFERENCES public.staff(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create staff table
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  specialties TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create services table  
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create policies for appointments (public access for now, can be restricted later)
CREATE POLICY "Anyone can view appointments" 
ON public.appointments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update appointments" 
ON public.appointments 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete appointments" 
ON public.appointments 
FOR DELETE 
USING (true);

-- Create policies for staff
CREATE POLICY "Anyone can view staff" 
ON public.staff 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage staff" 
ON public.staff 
FOR ALL 
USING (true);

-- Create policies for services
CREATE POLICY "Anyone can view services" 
ON public.services 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage services" 
ON public.services 
FOR ALL 
USING (true);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_updated_at
BEFORE UPDATE ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.staff (full_name, email, phone, specialties) VALUES
('Sarah Johnson', 'sarah@salon.com', '555-0101', ARRAY['Hair Styling', 'Color']),
('Mike Chen', 'mike@salon.com', '555-0102', ARRAY['Hair Cutting', 'Beard Trim']),
('Lisa Rodriguez', 'lisa@salon.com', '555-0103', ARRAY['Manicure', 'Pedicure', 'Nail Art']);

INSERT INTO public.services (name, description, duration_minutes, price, category) VALUES
('Haircut & Style', 'Professional haircut with styling', 60, 45.00, 'Hair'),
('Hair Color', 'Full hair coloring service', 120, 85.00, 'Hair'),
('Manicure', 'Classic nail care and polish', 45, 35.00, 'Nails'),
('Pedicure', 'Foot care and nail polish', 60, 45.00, 'Nails'),
('Beard Trim', 'Professional beard trimming and styling', 30, 25.00, 'Hair');