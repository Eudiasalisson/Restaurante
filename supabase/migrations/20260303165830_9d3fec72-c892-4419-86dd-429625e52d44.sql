
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

CREATE POLICY "auth_upload_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images');
CREATE POLICY "public_read_images" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "auth_update_images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'images');
CREATE POLICY "auth_delete_images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'images');
