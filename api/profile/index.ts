import { createClient } from '@supabase/supabase-js'
import { withAuth } from '../_middleware/auth.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null as any

const handler = async (wallet: string): Promise<Response> => {
  try {
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('wallet', wallet.toLowerCase())
      .limit(1)
      .maybeSingle()

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: data || null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Internal' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export default withAuth(handler)
export const config = { runtime: 'edge' }
