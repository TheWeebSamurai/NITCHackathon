import { supabase } from '../utils/supabase';

export async function lookupKeralaPincode(pin) {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('Enter a valid 6-digit PIN code.');
  }

  const { data, error } = await supabase.functions.invoke('verify-kerala-pin', { body: { pin } });
  if (error) {
    throw new Error(`Kerala PIN verification is unavailable: ${error.message}. Please try again later.`, { cause: error });
  }
  if (!data?.valid || !Array.isArray(data.localities) || data.localities.length === 0) {
    throw new Error(data?.error ?? 'That PIN code was not verified as a Kerala postal PIN.');
  }
  return data.localities;
}
