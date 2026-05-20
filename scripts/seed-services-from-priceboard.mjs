import { createClient } from "@supabase/supabase-js";
import { getMergedEnv } from "./shared-env.mjs";

const mergedEnv = getMergedEnv(process.env);
const supabaseUrl =
  mergedEnv.NEXT_PUBLIC_SUPABASE_URL ||
  mergedEnv.EXPO_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  mergedEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env. Set NEXT_PUBLIC_* or EXPO_PUBLIC_* credentials in the repo env files.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const priceFormatter = new Intl.NumberFormat("vi-VN");

const serviceRows = [
  ["SUA DA", 40000],
  ["SON GEL CO BAN", 100000],
  ["GEL THACH", 100000],
  ["COMBO SUA SON GEL + CUNG MONG TAY", 150000],
  ["COMBO SUA SON GEL CHAN", 120000],
  ["NHU", 30000], ["NHU", 40000],
  ["MAT MEO", 30000], ["MAT MEO", 40000],
  ["NHU FLASH", 30000], ["NHU FLASH", 40000],
  ["TRANG GUONG", 30000], ["TRANG GUONG", 40000],
  ["MIX MAU", 10000], ["MIX MAU", 20000],
  ["CUNG MONG TAO CAU", 30000], ["CUNG MONG TAO CAU", 40000], ["CUNG MONG TAO CAU", 50000],
  ["THAO GEL MEM", 20000],
  ["THAO GEL CUNG, BOT", 30000], ["THAO GEL CUNG, BOT", 40000], ["THAO GEL CUNG, BOT", 50000],
  ["THAO MONG UP", 30000], ["THAO MONG UP", 40000], ["THAO MONG UP", 50000],
  ["BIAB", 200000], ["BIAB", 210000], ["BIAB", 220000], ["BIAB", 230000], ["BIAB", 240000], ["BIAB", 250000],
  ["MONG UP GEL", 100000],
  ["DUAL FORM", 250000],
  ["DAP GEL MONG THAT", 150000],
  ["REFILL MONG THAT/GIA", 100000],
  ["VA MONG", 20000],
  ["MAT MEO LE", 10000],
  ["TRANG GUONG / NGON", 10000],
  ["TRANG GUONG VE NOI / NGON", 10000], ["TRANG GUONG VE NOI / NGON", 15000],
  ["VE NOI / NGON", 10000], ["VE NOI / NGON", 20000], ["VE NOI / NGON", 30000], ["VE NOI / NGON", 40000],
  ["VE MONG / NGON", 10000], ["VE MONG / NGON", 20000], ["VE MONG / NGON", 30000], ["VE MONG / NGON", 40000],
  ["VE MONG / NGON", 50000], ["VE MONG / NGON", 60000], ["VE MONG / NGON", 70000], ["VE MONG / NGON", 80000],
  ["VE MONG / NGON", 90000], ["VE MONG / NGON", 100000], ["VE MONG / NGON", 110000], ["VE MONG / NGON", 120000],
  ["VE MONG / NGON", 130000], ["VE MONG / NGON", 140000], ["VE MONG / NGON", 150000],
  ["LOANG/NUANCE / NGON", 10000], ["LOANG/NUANCE / NGON", 20000], ["LOANG/NUANCE / NGON", 30000], ["LOANG/NUANCE / NGON", 40000],
  ["XA CU / NGON", 5000], ["XA CU / NGON", 10000], ["XA CU / NGON", 15000], ["XA CU / NGON", 20000], ["XA CU / NGON", 25000], ["XA CU / NGON", 30000],
  ["HOA KHO / NGON", 5000], ["HOA KHO / NGON", 10000], ["HOA KHO / NGON", 15000], ["HOA KHO / NGON", 20000], ["HOA KHO / NGON", 25000], ["HOA KHO / NGON", 30000],
  ["NHU FOIL / NGON", 5000], ["NHU FOIL / NGON", 10000], ["NHU FOIL / NGON", 15000], ["NHU FOIL / NGON", 20000], ["NHU FOIL / NGON", 25000], ["NHU FOIL / NGON", 30000],
  ["OMBRE / NGON", 10000], ["OMBRE / NGON", 15000], ["OMBRE / NGON", 20000], ["OMBRE / NGON", 25000],
  ["OMBRE CHE KHUYET DIEM / NGON", 3000],
  ["DINH DA", 2500], ["DINH DA", 5000], ["DINH DA", 7500], ["DINH DA", 10000],
  ["DINH DA KHOI", 5000], ["DINH DA KHOI", 10000], ["DINH DA KHOI", 15000], ["DINH DA KHOI", 20000], ["DINH DA KHOI", 25000],
  ["DINH CHARM", 10000], ["DINH CHARM", 20000], ["DINH CHARM", 30000], ["DINH CHARM", 40000], ["DINH CHARM", 50000],
  ["CHARM KHUON", 20000], ["CHARM KHUON", 30000], ["CHARM KHUON", 40000],
  ["PHU KIEN KIM LOAI", 2500], ["PHU KIEN KIM LOAI", 5000], ["PHU KIEN KIM LOAI", 7500], ["PHU KIEN KIM LOAI", 10000],
  ["STICKER AN", 5000], ["STICKER AN", 10000],
];

const services = serviceRows.map(([name, price], index) => ({
  name: `${name} - ${priceFormatter.format(price)}d`,
  short_description: "Cap nhat tu bang gia CHAM BEAUTY",
  image_url: null,
  display_order: index + 1,
  featured_in_lookbook: false,
  duration_min: 45,
  base_price: price,
  vat_rate: 0,
  active: true,
}));

async function resolveOrgId() {
  const { data: orgs, error } = await supabase.from("orgs").select("id").limit(1);
  if (error) {
    throw error;
  }

  const existingOrgId = orgs?.[0]?.id;
  if (existingOrgId) {
    return existingOrgId;
  }

  const { data, error: createError } = await supabase
    .from("orgs")
    .insert({ name: "Nails Demo Org" })
    .select("id")
    .single();

  if (createError) {
    throw createError;
  }

  return data.id;
}

async function replaceServicesForOrg(orgId) {
  const { error: deleteError } = await supabase.from("services").delete().eq("org_id", orgId);
  if (deleteError) {
    throw deleteError;
  }

  const batchSize = 25;
  for (let startIndex = 0; startIndex < services.length; startIndex += batchSize) {
    const batch = services
      .slice(startIndex, startIndex + batchSize)
      .map((service) => ({ ...service, org_id: orgId }));

    const { error } = await supabase.from("services").insert(batch);
    if (error) {
      throw error;
    }
  }
}

async function main() {
  const orgId = await resolveOrgId();
  await replaceServicesForOrg(orgId);
  console.log(`Inserted ${services.length} services for org ${orgId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
