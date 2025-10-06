-- Remove duplicate entries, keeping only the most recent entry for each rig_number and date combination
DELETE FROM extracted_ddor_data
WHERE id NOT IN (
  SELECT DISTINCT ON (rig_number, date) id
  FROM extracted_ddor_data
  ORDER BY rig_number, date, created_at DESC
);

-- Now add unique constraint on rig_number and date combination to prevent future duplicates
ALTER TABLE extracted_ddor_data
ADD CONSTRAINT extracted_ddor_data_rig_date_unique UNIQUE (rig_number, date);