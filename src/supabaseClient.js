import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lynpuzfydharnximxwey.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5bnB1emZ5ZGhhcm54aW14d2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODA5MzIsImV4cCI6MjA5MDQ1NjkzMn0.XV9ckOA4NsB1ObbqSBBbNhHmzcrNCn5HMop8cryRUrc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
