import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      status: 'error',
      message: 'Missing Supabase environment variables',
      details: {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey,
      },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Query minima solo per verificare che la connessione funzioni
    const { error } = await supabase
      .from('pg_stat_activity' as never)
      .select('*')
      .limit(1);

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    return res
      .status(200)
      .json({ status: 'ok', message: 'Supabase connection successful' });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
