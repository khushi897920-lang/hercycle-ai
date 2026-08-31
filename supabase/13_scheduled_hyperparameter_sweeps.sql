-- HerCycle AI — Scheduled Hyper-Parameter Sweeps Schema (Migration 13)

CREATE TABLE IF NOT EXISTS public.sweeps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model_id TEXT NOT NULL,
    sweep_type TEXT NOT NULL CHECK (sweep_type IN ('grid', 'random')),
    cron_expression TEXT NOT NULL,
    hyperparameter_space JSONB NOT NULL DEFAULT '{}'::jsonb,
    max_trials INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'paused', 'failed')),
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ NOT NULL,
    best_trial JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sweeps_model ON public.sweeps(model_id);
CREATE INDEX IF NOT EXISTS idx_sweeps_next_run ON public.sweeps(next_run_at, status);
ALTER TABLE public.sweeps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sweep_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sweep_id UUID REFERENCES public.sweeps(id) ON DELETE CASCADE,
    trial_index INTEGER NOT NULL,
    hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    accuracy NUMERIC(5,4) NOT NULL,
    loss NUMERIC(6,4) NOT NULL,
    val_loss NUMERIC(6,4),
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sweep_trials_sweep ON public.sweep_trials(sweep_id);
ALTER TABLE public.sweep_trials ENABLE ROW LEVEL SECURITY;
