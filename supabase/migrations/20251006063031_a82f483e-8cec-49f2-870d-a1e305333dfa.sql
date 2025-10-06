-- Create table for rig configurations
CREATE TABLE public.rig_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rig_number TEXT NOT NULL UNIQUE,
  sheet_name TEXT NOT NULL DEFAULT 'DAILY DRILLING REPORT',
  column_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.rig_configs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is internal config data)
CREATE POLICY "Allow all operations on rig_configs"
ON public.rig_configs
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_rig_configs_updated_at
BEFORE UPDATE ON public.rig_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();