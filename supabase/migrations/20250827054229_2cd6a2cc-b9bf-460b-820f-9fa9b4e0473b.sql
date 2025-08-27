-- Create notifications table for real notifications system
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  viewed_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their organization notifications" 
ON public.notifications 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Organization admins can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can update their own notification read status" 
ON public.notifications 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Organization admins can delete notifications" 
ON public.notifications 
FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();