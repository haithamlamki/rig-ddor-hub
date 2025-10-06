-- Update Rig 206 records to use the configured client name from rig_configs
UPDATE extracted_ddor_data
SET client = 'Oxy'
WHERE rig_number = '206' AND (client IS NULL OR client = '');