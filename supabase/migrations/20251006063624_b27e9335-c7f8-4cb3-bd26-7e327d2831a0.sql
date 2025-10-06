-- Create table to store extracted DDOR data
CREATE TABLE public.extracted_ddor_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rig_number TEXT NOT NULL,
  date DATE NOT NULL,
  client TEXT,
  operation_hr NUMERIC DEFAULT 0,
  reduce_hr NUMERIC DEFAULT 0,
  standby_hr NUMERIC DEFAULT 0,
  zero_hr NUMERIC DEFAULT 0,
  repair_hr NUMERIC DEFAULT 0,
  am_hr NUMERIC DEFAULT 0,
  special_hr NUMERIC DEFAULT 0,
  force_majeure_hr NUMERIC DEFAULT 0,
  stacking_hr NUMERIC DEFAULT 0,
  rig_move_hr NUMERIC DEFAULT 0,
  not_received_ddor TEXT,
  total_hrs NUMERIC DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.extracted_ddor_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on extracted_ddor_data" 
ON public.extracted_ddor_data 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_extracted_ddor_data_updated_at
BEFORE UPDATE ON public.extracted_ddor_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_extracted_ddor_data_rig_date ON public.extracted_ddor_data(rig_number, date);