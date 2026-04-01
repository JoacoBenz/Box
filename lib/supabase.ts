import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not configured');
    }
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return _supabaseAdmin;
}

// Upload a file to Supabase Storage
export async function uploadFile(
  tenantId: number,
  entidad: string,
  entidadId: number,
  file: File
): Promise<{ path: string; url: string }> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${tenantId}/${entidad}/${entidadId}/${timestamp}_${safeName}`;

  const buffer = await file.arrayBuffer();
  const { error } = await getSupabaseAdmin().storage
    .from('compras-escolar')
    .upload(path, buffer, { contentType: file.type });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  return { path, url: path };
}

// Generate a signed URL for downloading
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin().storage
    .from('compras-escolar')
    .createSignedUrl(path, 3600);

  if (error || !data) throw new Error('Error generando URL de descarga');
  return data.signedUrl;
}

// Delete a file from storage
export async function deleteFile(path: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage
    .from('compras-escolar')
    .remove([path]);

  if (error) throw new Error(`Error eliminando archivo: ${error.message}`);
}
