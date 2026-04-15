-- Enable RLS on appointments table if not already enabled
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;

-- Create policy for all authenticated users to read appointments
DROP POLICY IF EXISTS "Allow authenticated users to read appointments" ON public.appointments;
CREATE POLICY "Allow authenticated users to read appointments" ON public.appointments
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for all authenticated users to update appointments
DROP POLICY IF EXISTS "Allow authenticated users to update appointments" ON public.appointments;
CREATE POLICY "Allow authenticated users to update appointments" ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policy for all authenticated users to insert appointments
DROP POLICY IF EXISTS "Allow authenticated users to insert appointments" ON public.appointments;
CREATE POLICY "Allow authenticated users to insert appointments" ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure booking_requests table has similar policies
ALTER TABLE IF EXISTS public.booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read booking_requests" ON public.booking_requests;
CREATE POLICY "Allow authenticated users to read booking_requests" ON public.booking_requests
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update booking_requests" ON public.booking_requests;
CREATE POLICY "Allow authenticated users to update booking_requests" ON public.booking_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure tickets table has access
ALTER TABLE IF EXISTS public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read tickets" ON public.tickets;
CREATE POLICY "Allow authenticated users to read tickets" ON public.tickets
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert tickets" ON public.tickets;
CREATE POLICY "Allow authenticated users to insert tickets" ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update tickets" ON public.tickets;
CREATE POLICY "Allow authenticated users to update tickets" ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure customers table has access
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read customers" ON public.customers;
CREATE POLICY "Allow authenticated users to read customers" ON public.customers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert customers" ON public.customers;
CREATE POLICY "Allow authenticated users to insert customers" ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update customers" ON public.customers;
CREATE POLICY "Allow authenticated users to update customers" ON public.customers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);