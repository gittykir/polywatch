-- Add INSERT policy to ensure users can only create their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Add DELETE policy to prevent users from deleting profiles (or only their own if needed)
CREATE POLICY "Users cannot delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (false);