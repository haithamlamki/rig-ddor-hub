-- Proportionally scale down individual hour components where they sum to more than 24
-- This ensures consistency between individual hours and total hours
WITH hour_sums AS (
  SELECT 
    id,
    operation_hr + reduce_hr + standby_hr + zero_hr + repair_hr + 
    am_hr + special_hr + force_majeure_hr + stacking_hr + rig_move_hr AS calculated_total
  FROM extracted_ddor_data
)
UPDATE extracted_ddor_data
SET 
  operation_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN operation_hr * (24.0 / hour_sums.calculated_total)
    ELSE operation_hr
  END,
  reduce_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN reduce_hr * (24.0 / hour_sums.calculated_total)
    ELSE reduce_hr
  END,
  standby_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN standby_hr * (24.0 / hour_sums.calculated_total)
    ELSE standby_hr
  END,
  zero_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN zero_hr * (24.0 / hour_sums.calculated_total)
    ELSE zero_hr
  END,
  repair_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN repair_hr * (24.0 / hour_sums.calculated_total)
    ELSE repair_hr
  END,
  am_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN am_hr * (24.0 / hour_sums.calculated_total)
    ELSE am_hr
  END,
  special_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN special_hr * (24.0 / hour_sums.calculated_total)
    ELSE special_hr
  END,
  force_majeure_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN force_majeure_hr * (24.0 / hour_sums.calculated_total)
    ELSE force_majeure_hr
  END,
  stacking_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN stacking_hr * (24.0 / hour_sums.calculated_total)
    ELSE stacking_hr
  END,
  rig_move_hr = CASE 
    WHEN hour_sums.calculated_total > 24 
    THEN rig_move_hr * (24.0 / hour_sums.calculated_total)
    ELSE rig_move_hr
  END,
  total_hrs = 24
FROM hour_sums
WHERE extracted_ddor_data.id = hour_sums.id 
  AND hour_sums.calculated_total > 24;