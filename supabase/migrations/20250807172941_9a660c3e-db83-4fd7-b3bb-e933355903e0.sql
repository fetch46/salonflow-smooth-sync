-- Fix user profile creation trigger to handle more metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    email,
    phone,
    business_name,
    business_phone,
    business_email,
    role
  )
  VALUES (
    new.id, 
    COALESCE(
      CONCAT(new.raw_user_meta_data ->> 'first_name', ' ', new.raw_user_meta_data ->> 'last_name'),
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'business_name',
    new.raw_user_meta_data ->> 'business_phone',
    new.raw_user_meta_data ->> 'business_email',
    COALESCE(new.raw_user_meta_data ->> 'role', 'staff')
  );
  RETURN new;
END;
$function$;

-- Ensure the trigger exists for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add helpful function to check if user has organization
CREATE OR REPLACE FUNCTION public.user_has_organization(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_users 
    WHERE user_id = user_uuid 
    AND is_active = true
  );
$$;

-- Function to get user's organization count
CREATE OR REPLACE FUNCTION public.get_user_organization_count(user_uuid uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM organization_users 
  WHERE user_id = user_uuid 
  AND is_active = true;
$$;