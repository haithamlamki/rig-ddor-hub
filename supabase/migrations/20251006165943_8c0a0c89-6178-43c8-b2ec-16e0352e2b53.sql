-- Add total_amount column to extracted_ddor_data table for storing Hoist rig billing totals
ALTER TABLE public.extracted_ddor_data 
ADD COLUMN total_amount numeric DEFAULT 0;