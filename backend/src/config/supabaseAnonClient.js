const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "SUPABASE_URL ve SUPABASE_ANON_KEY ortam değişkenleri tanımlı olmalı"
  );
}

// anon key, normal kullanıcı bağlamındaki auth işlemleri (signUp,
// signInWithPassword, getUser) için kullanılır; service_role'ün aksine
// RLS'i bypass etmez.
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabaseAnon;
