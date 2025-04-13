
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export const createSupabaseClient = (url: string, key: string) => {
  return createClient(url, key);
};
