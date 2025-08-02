-- Create staff table first
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

-- Create appointments table (now staff table exists)
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

-- Enable Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (can be restricted later)
CREATE POLICY "Public access to appointments" ON public.appointments FOR ALL USING (true);
CREATE POLICY "Public access to staff" ON public.staff FOR ALL USING (true);
CREATE POLICY "Public access to services" ON public.services FOR ALL USING (true);

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