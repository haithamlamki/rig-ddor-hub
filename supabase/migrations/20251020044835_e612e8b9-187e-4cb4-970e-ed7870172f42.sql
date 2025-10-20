-- Create npt_records table
CREATE TABLE public.npt_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rig_number TEXT NOT NULL,
  year INTEGER NOT NULL,
  month TEXT NOT NULL,
  date DATE NOT NULL,
  hours NUMERIC NOT NULL,
  npt_type TEXT,
  system TEXT,
  equipment TEXT,
  the_part TEXT,
  contractual TEXT,
  department_responsibility TEXT,
  failure_description TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  future_action TEXT,
  action_party TEXT,
  notification_number_n2 TEXT,
  failure_investigation_reports TEXT,
  data_quality_score NUMERIC DEFAULT 0,
  missing_fields JSONB DEFAULT '[]'::jsonb,
  data_quality_issues JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create npt_data_quality table
CREATE TABLE public.npt_data_quality (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  npt_record_id UUID NOT NULL,
  quality_issue_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_npt_record FOREIGN KEY (npt_record_id) REFERENCES public.npt_records(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.npt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npt_data_quality ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for npt_records
CREATE POLICY "Allow all operations on npt_records"
ON public.npt_records
FOR ALL
USING (true)
WITH CHECK (true);

-- Create RLS policies for npt_data_quality
CREATE POLICY "Allow all operations on npt_data_quality"
ON public.npt_data_quality
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_npt_records_rig_number ON public.npt_records(rig_number);
CREATE INDEX idx_npt_records_date ON public.npt_records(date);
CREATE INDEX idx_npt_records_system ON public.npt_records(system);
CREATE INDEX idx_npt_records_root_cause ON public.npt_records(root_cause);
CREATE INDEX idx_npt_records_quality_score ON public.npt_records(data_quality_score);
CREATE INDEX idx_npt_data_quality_record_id ON public.npt_data_quality(npt_record_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_npt_records_updated_at
BEFORE UPDATE ON public.npt_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();