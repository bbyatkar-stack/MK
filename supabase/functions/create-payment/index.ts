// Серверная функция Supabase: создаёт платёж в ЮKassa для пополнения баланса.
// Сумма и количество баллов берутся ТОЛЬКО из таблицы payment_packages в БД —
// клиент передаёт лишь package_id, доверенных значений с клиента нет.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Временно — адрес дев-сервера. После публикации на Vercel поменять секрет
// SITE_URL на боевой домен: supabase secrets set SITE_URL=https://...
const SITE_URL = Deno.env.get('SITE_URL') || 'http://127.0.0.1:5175'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Не авторизован' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'Не авторизован' }, 401)
    }
    const userId = userData.user.id

    const { package_id: packageId } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('payment_packages')
      .select('points, amount_rub')
      .eq('id', packageId)
      .eq('is_active', true)
      .maybeSingle()

    if (pkgError || !pkg) {
      return json({ error: 'Некорректный package_id' }, 400)
    }

    const shopId = Deno.env.get('YOOKASSA_SHOP_ID')!
    const secretKey = Deno.env.get('YOOKASSA_SECRET_KEY')!
    const idempotenceKey = crypto.randomUUID()

    console.log(`create-payment: user=${userId} package=${packageId}`)

    const yookassaResp = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        Authorization: 'Basic ' + btoa(`${shopId}:${secretKey}`),
      },
      body: JSON.stringify({
        amount: { value: pkg.amount_rub.toFixed(2), currency: 'RUB' },
        confirmation: { type: 'redirect', return_url: `${SITE_URL}/?payment=processing` },
        capture: true,
        description: `Пополнение баланса: ${packageId}`,
        metadata: { user_id: userId, package_id: packageId, points: pkg.points },
      }),
    })

    if (!yookassaResp.ok) {
      console.error('create-payment: YooKassa error', await yookassaResp.text())
      return json({ error: 'Ошибка создания платежа' }, 500)
    }

    const payment = await yookassaResp.json()

    const { error: insertError } = await supabaseAdmin.from('payment_transactions').insert({
      user_id: userId,
      provider: 'yookassa',
      provider_payment_id: payment.id,
      idempotence_key: idempotenceKey,
      package_id: packageId,
      amount_rub: pkg.amount_rub,
      points: pkg.points,
      status: 'pending',
      raw_payload: payment,
    })

    if (insertError) {
      console.error('create-payment: DB insert error', insertError.message)
      return json({ error: 'Ошибка сохранения платежа' }, 500)
    }

    console.log(`create-payment: created payment_id=${payment.id}`)

    return json({
      payment_id: payment.id,
      confirmation_url: payment.confirmation?.confirmation_url,
    })
  } catch (e) {
    console.error('create-payment: unexpected error', e)
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
