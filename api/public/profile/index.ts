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
      .from('profiles')
      .select('*')
      .limit(1)

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    let matched = data || null
    if (wallet && Array.isArray(data)) {
      matched = data.find((row) => String(row.wallet || '').toLowerCase() === wallet) || null
    }

    return new Response(JSON.stringify({ success: true, data: matched }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Internal' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export default handler
