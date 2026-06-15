-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create storage bucket for clips (public)
insert into storage.buckets (id, name, public)
values ('clips', 'clips', true)
on conflict (id) do nothing;

-- 2. Allow authenticated users to upload to their own folder
create policy "Users can upload their clips"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'clips'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow anyone to read public clips
create policy "Public clips are viewable by everyone"
on storage.objects for select
to public
using (bucket_id = 'clips');

-- 4. Allow users to delete their own clips
create policy "Users can delete their own clips"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'clips'
  and (storage.foldername(name))[1] = auth.uid()::text
);
