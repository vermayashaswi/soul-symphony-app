-- Add first_smart_chat_visit field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN first_smart_chat_visit boolean DEFAULT true;