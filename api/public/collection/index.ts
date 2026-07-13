import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null as any

export const config = { runtime: 'edge' }

const handler = async (req: Request): Promise<Response> => {
  try {
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Not configured' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const wallet = (url.searchParams.get('wallet') || '').toLowerCase()

    const { data, error } = await supabaseAdmin
      .from('collection')
      .select('wallet, card_id, card_name, card_img, tier, set_id, local_id, hp, types, rarity, atk, def, level, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('public collection error', error)
      return new Response(JSON.stringify({ success: false, error: 'failed' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    let items = data || []
    if (wallet && items.length) {
      items = items.filter((row: any) => String(row?.wallet ?? '').toLowerCase() === wallet)
      if (!items.length) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ success: true, data: items }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('public collection fatal', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Internal' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export default handler
