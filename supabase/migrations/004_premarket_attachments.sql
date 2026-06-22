-- ── ATTACHMENT COLUMNS ───────────────────────────────────────────────────────
-- Add file-attachment support to pre-market journal entries.
ALTER TABLE premarket_entries
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- ── PREMARKET ATTACHMENTS STORAGE BUCKET ────────────────────────────────────
-- Public bucket: anyone with the full URL can read.
-- Path pattern: {user_id}/{timestamp}.{ext} — owner uid is first path segment.
INSERT INTO storage.buckets (id, name, public)
VALUES ('premarket-attachments', 'premarket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Only the object owner (first path segment = their uid) may write or delete.
CREATE POLICY "premarket attachments: owner insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'premarket-attachments'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "premarket attachments: owner update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'premarket-attachments'
    AND auth.uid()::text = split_part(name, '/', 1)
  )
  WITH CHECK (
    bucket_id = 'premarket-attachments'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "premarket attachments: owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'premarket-attachments'
    AND auth.uid()::text = split_part(name, '/', 1)
  );
