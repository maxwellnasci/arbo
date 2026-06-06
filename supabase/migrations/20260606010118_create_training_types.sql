CREATE TABLE IF NOT EXISTS training_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  is_custom boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE training_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access training_types"
  ON training_types FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Alunos select training_types"
  ON training_types FOR SELECT TO authenticated
  USING (true);

GRANT SELECT, INSERT, DELETE ON training_types TO authenticated;

ALTER TABLE trainings ALTER COLUMN type TYPE text USING type::text;
