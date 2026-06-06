-- Prevent duplicate custom type names (issue: no unique constraint on name)
ALTER TABLE training_types ADD CONSTRAINT training_types_name_unique UNIQUE (name);
