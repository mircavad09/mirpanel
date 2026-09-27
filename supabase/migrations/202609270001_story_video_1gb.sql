begin;

update storage.buckets
set public = false,
    file_size_limit = 1073741824,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
where id = 'mirpanel-stories';

commit;
