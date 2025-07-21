
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://bmgdzbfbswcloxzhnzvn.supabase.co'
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZ2R6YmZic3djbG94emhuenZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMjc1NTMsImV4cCI6MjA2ODcwMzU1M30.D-p7dCic1JgNKmvGA-Z9vBz8ao9wqJpK9OQznK9KasE'
export const supabase = createClient(supabaseUrl, supabaseKey)

//https://bmgdzbfbswcloxzhnzvn.supabase.co/storage/v1/object/public/studyhubimages/Posts/cam.jpg