-- Add rig move rate ID and applied amount columns to extracted_ddor_data
ALTER TABLE public.extracted_ddor_data 
ADD COLUMN IF NOT EXISTS rig_move_rate_id text,
ADD COLUMN IF NOT EXISTS rig_move_amount_applied numeric DEFAULT 0;