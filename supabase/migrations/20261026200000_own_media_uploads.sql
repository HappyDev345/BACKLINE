drop policy if exists "authenticated uploads media" on storage.objects;

create policy "authenticated uploads media" on storage.objects for insert
  with check (
    bucket_id = 'media' and auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
