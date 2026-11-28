import type { Request, Response } from 'express';
import {
  handleTokenAndBody,
  withAuth,
  type AuthContext,
} from '../../_lib/auth.js';
import { sendTooManyRequests, withMethod } from '../../_lib/http.js';
import { createUserClient, isRateLimitError } from '../../_lib/supabase.js';
import { parseAccountInput } from '../_validation.js';

async function updateAccount(
  res: Response,
  auth: AuthContext,
  token: string,
  body: Record<string, unknown>,
) {
  const parsed = parseAccountInput(body);
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }
  const { first_name, last_name } = parsed.value;

  // Acts as the caller, so RLS applies. Whitelist: only the two names are
  // written, so role and status can never reach the database from here (the
  // prevent_privilege_change trigger is the last line of defense). The id
  // filter comes from the verified session, never from the request.
  // The casts are the same justified exception as the other 'profiles' ones:
  // the generated DB types are still empty.
  const supabase = createUserClient(token);
  const { data: profile, error } = await supabase
    .from('profiles' as never)
    .update({ first_name, last_name } as never)
    .eq('id', auth.id)
    .select('first_name, last_name')
    .maybeSingle();
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  if (error) {
    throw error;
  }
  if (!profile) {
    return res.status(404).json({ message: 'Account not found' });
  }

  // Without generated DB types the row has no type: these are the two columns
  // selected above, just written with validated strings.
  const saved = profile as { first_name: string; last_name: string };

  return res.status(200).json({
    account: {
      first_name: saved.first_name,
      last_name: saved.last_name,
      email: auth.email,
    },
  });
}

function handleUpdate(req: Request, res: Response, auth: AuthContext) {
  // Personal data that depends on the cookie: no cache may keep it.
  res.setHeader('Cache-Control', 'no-store');
  return handleTokenAndBody(req, res, (token, body) =>
    updateAccount(res, auth, token, body),
  );
}

export default withMethod('PUT', withAuth(handleUpdate));
