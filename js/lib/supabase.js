import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://tgkikvzyxvtdvaukutju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRna2lrdnp5eHZ0ZHZhdWt1dGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MzAwNTQsImV4cCI6MjA5NTAwNjA1NH0.03Bf4rb3sUdEzfWSx42Nm0hRvMmuG_BLmezx3W8a34k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const EDGE_URL = `${SUPABASE_URL}/functions/v1`;
