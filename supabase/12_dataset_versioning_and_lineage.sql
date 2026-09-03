-- HerCycle AI — Dataset Versioning & Lineage Tracking Schema (Migration 12)

CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version_hash TEXT UNIQUE NOT NULL,
    sample_count INTEGER NOT NULL DEFAULT 0,
    file_path TEXT,
    preprocessing_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_datasets_name_version ON public.datasets(name, version_hash);
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dataset_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
    dataset_version_hash TEXT NOT NULL,
    preprocessing_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_lineage_model ON public.dataset_lineage(model_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_hash ON public.dataset_lineage(dataset_version_hash);
ALTER TABLE public.dataset_lineage ENABLE ROW LEVEL SECURITY;
