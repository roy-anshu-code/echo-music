-- First create a PRIVATE Storage bucket named "music" in the Supabase dashboard.
-- Then run these policies in SQL Editor.

drop policy if exists "Users upload music to their own folder" on storage.objects;
create policy "Users upload music to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'music'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users read music from their own folder" on storage.objects;
create policy "Users read music from their own folder"
on storage.objects for select to authenticated
using (
  bucket_id = 'music'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete music from their own folder" on storage.objects;
create policy "Users delete music from their own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'music'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
