-- Fix RLS policies on chat_messages table to handle edge cases better
-- The issue is that the RLS policy checks for thread ownership but might fail in edge cases

-- Drop existing policies to recreate them with better logic
DROP POLICY IF EXISTS "Users can insert messages in own threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can update messages in own threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in own threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete messages in own threads" ON chat_messages;

-- Recreate policies with more robust thread-user relationship checks
CREATE POLICY "Users can insert messages in own threads" ON chat_messages
FOR INSERT 
WITH CHECK (
  -- Allow if thread belongs to authenticated user OR if this is a service role operation
  EXISTS (
    SELECT 1 FROM chat_threads ct 
    WHERE ct.id = thread_id 
    AND (ct.user_id = auth.uid() OR auth.role() = 'service_role')
  )
);

CREATE POLICY "Users can update messages in own threads" ON chat_messages
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM chat_threads ct 
    WHERE ct.id = thread_id 
    AND (ct.user_id = auth.uid() OR auth.role() = 'service_role')
  )
);

CREATE POLICY "Users can view messages in own threads" ON chat_messages
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM chat_threads ct 
    WHERE ct.id = thread_id 
    AND (ct.user_id = auth.uid() OR auth.role() = 'service_role')
  )
);

CREATE POLICY "Users can delete messages in own threads" ON chat_messages
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM chat_threads ct 
    WHERE ct.id = thread_id 
    AND (ct.user_id = auth.uid() OR auth.role() = 'service_role')
  )
);