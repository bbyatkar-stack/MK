// Серверная функция Supabase: принимает webhook от ЮKassa. Публичный endpoint
// (без JWT) — но мы НИКОГДА не доверяем статусу платежа из тела webhook,
// а перепроверяем его напрямую через API ЮKassa своим секретным ключом.
// Начисление баллов идёт через atomic-функцию apply_successful_payment —
// повторные webhook по одному и тому же платежу баланс не увеличивают.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function fetchYooKassaPayment(paymentId: string) {
  const shopId = Deno.env.get('YOOKASSA_SHOP_ID')!
  const secretKey = Deno.env.get('YOOKASSA_SECRET_KEY')!
  const resp = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: 'Basic ' + btoa(`${shopId}:${secretKey}`) },
  })
  if (!resp.ok) return null
  return await resp.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const paymentId = body?.object?.id
    if (!paymentId) {
      console.error('yookassa-webhook: no payment id in body')
      return json({ error: 'Некорректный webhook' }, 400)
    }

    console.log(`yookassa-webhook: event=${body.event} payment_id=${paymentId}`)

    // Перепроверяем статус напрямую у ЮKassa — телу webhook не доверяем.
    const confirmed = await fetchYooKassaPayment(paymentId)
    if (!confirmed) {
      console.error(`yookassa-webhook: could not confirm payment ${paymentId} with YooKassa`)
      return json({ error: 'Не удалось подтвердить платёж' }, 502)
    }

    const { data: paymentRow, error: findError } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, status')
      .eq('provider_payment_id', paymentId)
      .maybeSingle()

    if (findError || !paymentRow) {
      console.error(`yookassa-webhook: unknown payment ${paymentId}`)
      return json({ ok: true })
    }

    if (confirmed.status === 'succeeded') {
      const { error: rpcError } = await supabaseAdmin.rpc('apply_successful_payment', {
        p_payment_id: paymentRow.id,
      })
      if (rpcError) {
        console.error('yookassa-webhook: apply_successful_payment failed', rpcError.message)
        return json({ error: 'Ошибка начисления' }, 500)
      }
      console.log(`yookassa-webhook: payment ${paymentId} succeeded, points applied`)
    } else if (confirmed.status === 'canceled' && paymentRow.status !== 'succeeded') {
      await supabaseAdmin
        .from('payment_transactions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', paymentRow.id)
      console.log(`yookassa-webhook: payment ${paymentId} canceled`)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('yookassa-webhook: unexpected error', e)
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
