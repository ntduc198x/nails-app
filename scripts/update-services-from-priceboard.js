const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const getEnv = (key) => ((env.match(new RegExp(`^${key}=(.*)$`, 'm')) || [])[1] || '').replace(/^"|"$/g, '');
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!url || !key) throw new Error('Missing Supabase env');

const supabase = createClient(url, key);

const services = [
  ['SỬA DA', 40000],
  ['SƠN GEL CƠ BẢN', 100000],
  ['GEL THẠCH', 100000],
  ['COMBO SỬA SƠN GEL + CỨNG MÓNG TAY', 150000],
  ['COMBO SỬA SƠN GEL CHÂN', 120000],
  ['NHŨ', 30000], ['NHŨ', 40000],
  ['MẮT MÈO', 30000], ['MẮT MÈO', 40000],
  ['NHŨ FLASH', 30000], ['NHŨ FLASH', 40000],
  ['TRÁNG GƯƠNG', 30000], ['TRÁNG GƯƠNG', 40000],
  ['MIX MÀU', 10000], ['MIX MÀU', 20000],
  ['CỨNG MÓNG TẠO CẦU', 30000], ['CỨNG MÓNG TẠO CẦU', 40000], ['CỨNG MÓNG TẠO CẦU', 50000],
  ['THÁO GEL MỀM', 20000],
  ['THÁO GEL CỨNG, BỘT', 30000], ['THÁO GEL CỨNG, BỘT', 40000], ['THÁO GEL CỨNG, BỘT', 50000],
  ['THÁO MÓNG UP', 30000], ['THÁO MÓNG UP', 40000], ['THÁO MÓNG UP', 50000],
  ['BIAB', 200000], ['BIAB', 210000], ['BIAB', 220000], ['BIAB', 230000], ['BIAB', 240000], ['BIAB', 250000],
  ['MÓNG UP GEL', 100000],
  ['DUAL FORM', 250000],
  ['ĐẮP GEL MÓNG THẬT', 150000],
  ['REFILL MÓNG THẬT/GIẢ', 100000],
  ['VÁ MÓNG', 20000],
  ['MẮT MÈO LẺ', 10000],
  ['TRÁNG GƯƠNG / NGÓN', 10000],
  ['TRÁNG GƯƠNG VẼ NỔI / NGÓN', 10000], ['TRÁNG GƯƠNG VẼ NỔI / NGÓN', 15000],
  ['VẼ NỔI / NGÓN', 10000], ['VẼ NỔI / NGÓN', 20000], ['VẼ NỔI / NGÓN', 30000], ['VẼ NỔI / NGÓN', 40000],
  ['VẼ MÓNG / NGÓN', 10000], ['VẼ MÓNG / NGÓN', 20000], ['VẼ MÓNG / NGÓN', 30000], ['VẼ MÓNG / NGÓN', 40000], ['VẼ MÓNG / NGÓN', 50000], ['VẼ MÓNG / NGÓN', 60000], ['VẼ MÓNG / NGÓN', 70000], ['VẼ MÓNG / NGÓN', 80000], ['VẼ MÓNG / NGÓN', 90000], ['VẼ MÓNG / NGÓN', 100000], ['VẼ MÓNG / NGÓN', 110000], ['VẼ MÓNG / NGÓN', 120000], ['VẼ MÓNG / NGÓN', 130000], ['VẼ MÓNG / NGÓN', 140000], ['VẼ MÓNG / NGÓN', 150000],
  ['LOANG/NUANCE / NGÓN', 10000], ['LOANG/NUANCE / NGÓN', 20000], ['LOANG/NUANCE / NGÓN', 30000], ['LOANG/NUANCE / NGÓN', 40000],
  ['XÀ CỪ / NGÓN', 5000], ['XÀ CỪ / NGÓN', 10000], ['XÀ CỪ / NGÓN', 15000], ['XÀ CỪ / NGÓN', 20000], ['XÀ CỪ / NGÓN', 25000], ['XÀ CỪ / NGÓN', 30000],
  ['HOA KHÔ / NGÓN', 5000], ['HOA KHÔ / NGÓN', 10000], ['HOA KHÔ / NGÓN', 15000], ['HOA KHÔ / NGÓN', 20000], ['HOA KHÔ / NGÓN', 25000], ['HOA KHÔ / NGÓN', 30000],
  ['NHŨ FOIL / NGÓN', 5000], ['NHŨ FOIL / NGÓN', 10000], ['NHŨ FOIL / NGÓN', 15000], ['NHŨ FOIL / NGÓN', 20000], ['NHŨ FOIL / NGÓN', 25000], ['NHŨ FOIL / NGÓN', 30000],
  ['OMBRE / NGÓN', 10000], ['OMBRE / NGÓN', 15000], ['OMBRE / NGÓN', 20000], ['OMBRE / NGÓN', 25000],
  ['OMBRE CHE KHUYẾT ĐIỂM / NGÓN', 3000],
  ['ĐÍNH ĐÁ', 2500], ['ĐÍNH ĐÁ', 5000], ['ĐÍNH ĐÁ', 7500], ['ĐÍNH ĐÁ', 10000],
  ['ĐÍNH ĐÁ KHỐI', 5000], ['ĐÍNH ĐÁ KHỐI', 10000], ['ĐÍNH ĐÁ KHỐI', 15000], ['ĐÍNH ĐÁ KHỐI', 20000], ['ĐÍNH ĐÁ KHỐI', 25000],
  ['ĐÍNH CHARM', 10000], ['ĐÍNH CHARM', 20000], ['ĐÍNH CHARM', 30000], ['ĐÍNH CHARM', 40000], ['ĐÍNH CHARM', 50000],
  ['CHARM KHUÔN', 20000], ['CHARM KHUÔN', 30000], ['CHARM KHUÔN', 40000],
  ['PHỤ KIỆN KIM LOẠI', 2500], ['PHỤ KIỆN KIM LOẠI', 5000], ['PHỤ KIỆN KIM LOẠI', 7500], ['PHỤ KIỆN KIM LOẠI', 10000],
  ['STICKER ẨN', 5000], ['STICKER ẨN', 10000],
].map(([name, price], index) => ({
  name: `${name} - ${new Intl.NumberFormat('vi-VN').format(price)}đ`,
  short_description: 'Cập nhật từ bảng giá CHAM BEAUTY',
  image_url: null,
  display_order: index + 1,
  featured_in_lookbook: false,
  duration_min: 45,
  base_price: price,
  vat_rate: 0,
  active: true,
}));

async function main() {
  let { data: orgs, error: orgErr } = await supabase.from('orgs').select('id').limit(1);
  if (orgErr) throw orgErr;
  let orgId = orgs?.[0]?.id;

  if (!orgId) {
    const { data: createdOrg, error: createOrgErr } = await supabase.from('orgs').insert({ name: 'Nails Demo Org' }).select('id').single();
    if (createOrgErr) throw createOrgErr;
    orgId = createdOrg.id;
  }

  const { error: deleteErr } = await supabase.from('services').delete().eq('org_id', orgId);
  if (deleteErr) throw deleteErr;

  const batchSize = 25;
  for (let i = 0; i < services.length; i += batchSize) {
    const batch = services.slice(i, i + batchSize).map((service) => ({ ...service, org_id: orgId }));
    const { error } = await supabase.from('services').insert(batch);
    if (error) throw error;
  }

  console.log(`Inserted ${services.length} services for org ${orgId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
