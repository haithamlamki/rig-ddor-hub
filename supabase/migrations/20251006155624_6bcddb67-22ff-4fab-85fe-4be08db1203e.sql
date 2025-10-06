-- Create rig_rates table
CREATE TABLE public.rig_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rig_number TEXT NOT NULL UNIQUE,
  operation_hr_rate NUMERIC,
  reduce_hr_rate NUMERIC,
  standby_hr_rate NUMERIC,
  zero_hr_rate NUMERIC,
  repair_hr_rate NUMERIC,
  annual_maintenance_hr_rate NUMERIC,
  special_hr_rate NUMERIC,
  force_majeure_hr_rate NUMERIC,
  stacking_hr_rate NUMERIC,
  rig_move_hr_rate NUMERIC,
  rig_move_times NUMERIC,
  fuel_operation_day_rate_usd NUMERIC,
  fuel_reduce_day_rate_usd NUMERIC,
  fuel_zero_day_rate_usd NUMERIC,
  fuel_repair_day_rate_usd NUMERIC,
  fuel_special_day_rate_usd NUMERIC,
  obm_operation_day_rate_usd NUMERIC,
  obm_reduce_day_rate_usd NUMERIC,
  obm_zero_day_rate_usd NUMERIC,
  obm_repair_day_rate_usd NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rig_rates ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow all operations on rig_rates" 
ON public.rig_rates 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert initial data
INSERT INTO public.rig_rates (rig_number, operation_hr_rate, reduce_hr_rate, standby_hr_rate, zero_hr_rate, repair_hr_rate, annual_maintenance_hr_rate, special_hr_rate, force_majeure_hr_rate, stacking_hr_rate, rig_move_hr_rate, rig_move_times, fuel_operation_day_rate_usd, fuel_reduce_day_rate_usd, fuel_zero_day_rate_usd, fuel_repair_day_rate_usd, fuel_special_day_rate_usd, obm_operation_day_rate_usd, obm_reduce_day_rate_usd, obm_zero_day_rate_usd, obm_repair_day_rate_usd) VALUES
('103', 997.10, 847.49, 847.49, 0, 648.16, 997.10, 0, 349.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('104', 936.00, 795.60, 795.60, 0, 748.80, 936.00, 608.40, 280.80, 0, 0, 0, 0, 0, 0, 0, 0, 700.00, 0, 0, 0),
('105', 979.17, 636.46, 636.46, 0, 832.29, 979.17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('106', 1350.38, 1147.79, 1147.79, 0, 1080.30, 1350.38, 861.03, 397.37, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('107', 1350.38, 1147.79, 1147.79, 0, 1080.30, 1350.38, 861.03, 397.37, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('108', 1350.38, 1147.79, 1147.79, 0, 1080.30, 1350.38, 861.03, 397.37, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('109', 1350.38, 1147.79, 1147.79, 0, 1080.30, 1350.38, 861.03, 397.37, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('110', 1145.84, 973.92, 973.92, 0, 859.41, 1145.84, 687.48, 343.74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('111', 1145.84, 973.92, 973.92, 0, 859.41, 1145.84, 687.48, 343.74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('112', 793.32, 713.92, 713.92, 0, 713.92, 793.32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('201', 959.33, 815.43, 815.43, 0, 815.43, 959.33, 623.57, 287.80, 0, 0, 0, 2300.00, 1955.00, 2300.00, 1955.00, 1495.00, 512.00, 435.20, 0, 332.80),
('202', 959.33, 815.43, 815.43, 0, 815.43, 959.33, 623.57, 287.80, 0, 0, 0, 2300.00, 1955.00, 2300.00, 1955.00, 1495.00, 512.00, 435.20, 0, 332.80),
('203', 959.33, 815.43, 815.43, 0, 815.43, 959.33, 623.57, 287.80, 0, 0, 0, 2300.00, 1955.00, 2300.00, 1955.00, 1495.00, 512.00, 435.20, 0, 332.80),
('204', 1191.33, 1072.20, 1072.20, 0, 953.07, 1191.33, 595.67, 476.53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('205', 1126.45, 957.45, 957.45, 0, 844.78, 1126.45, 675.89, 337.89, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('206', 1104.17, 938.54, 938.54, 0, 717.71, 1104.17, 0, 552.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('207', 1104.17, 938.54, 938.54, 0, 717.71, 1104.17, 0, 552.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('208', 1104.17, 938.54, 938.54, 0, 717.71, 1104.17, 0, 552.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('209', 1104.17, 938.54, 938.54, 0, 717.71, 1104.17, 0, 552.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('210', 1115.83, 948.46, 948.46, 0, 836.88, 1115.83, 669.50, 334.75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('211', 881.69, 793.59, 793.59, 0, 793.59, 881.69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('301', 1023.64, 870.13, 870.13, 0, 818.89, 1023.64, 665.38, 0, 0, 0, 0, 4332.00, 3692.00, 4332.00, 3466.00, 2816.00, 700.00, 0, 0, 0),
('302', 1188.17, 1009.94, 1009.94, 0, 950.53, 1188.17, 772.31, 356.45, 0, 0, 0, 3000.00, 2550.00, 3000.00, 2400.00, 1950.00, 700.00, 595.00, 0, 560.00),
('303', 1188.17, 1009.94, 1009.94, 0, 950.53, 1188.17, 772.31, 356.45, 0, 0, 0, 3000.00, 2550.00, 3000.00, 2400.00, 1950.00, 700.00, 595.00, 0, 560.00),
('304', 1188.17, 1009.94, 1009.94, 0, 950.53, 1188.17, 772.31, 356.45, 0, 0, 0, 3000.00, 2550.00, 3000.00, 2400.00, 1950.00, 700.00, 595.00, 0, 560.00),
('305', 1372.88, 1166.96, 1166.96, 0, 1166.96, 1372.88, 0, 1166.96, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('306', 1082.79, 866.23, 920.37, 0, 866.23, 1082.79, 866.23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);