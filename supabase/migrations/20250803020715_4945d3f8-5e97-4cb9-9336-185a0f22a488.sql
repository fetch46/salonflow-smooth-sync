-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Public access to clients" 
ON public.clients 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample client data
INSERT INTO public.clients (full_name, email, phone, address, notes) VALUES
('Sarah Johnson', 'sarah.johnson@email.com', '+1-555-0101', '123 Main St, City, State 12345', 'Prefers natural hair products'),
('Emily Davis', 'emily.davis@email.com', '+1-555-0102', '456 Oak Ave, City, State 12346', 'Regular highlights every 6 weeks'),
('Jessica Wilson', 'jessica.wilson@email.com', '+1-555-0103', '789 Pine Rd, City, State 12347', 'Sensitive scalp - use gentle products'),
('Amanda Brown', 'amanda.brown@email.com', '+1-555-0104', '321 Elm St, City, State 12348', 'Color correction specialist needed'),
('Michelle Garcia', 'michelle.garcia@email.com', '+1-555-0105', '654 Maple Dr, City, State 12349', 'VIP client - priority booking');