const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri tanımlı olmalı"
  );
}

// service_role anahtarı RLS'i bypass eder; backend'in tüm tablolara
// erişmesi gerektiği için (örn. subscriptions_catalog/price_history'ye
// yazmak) bu anahtar kullanılıyor. İstemci tarafında asla kullanılmamalı.
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = supabase;
