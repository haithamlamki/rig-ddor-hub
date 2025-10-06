-- Cap all existing total_hrs values that exceed 24 hours to 24 hours
UPDATE extracted_ddor_data
SET total_hrs = 24
WHERE total_hrs > 24;