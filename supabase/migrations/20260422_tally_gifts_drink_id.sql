ALTER TABLE public.tally_gifts
  ADD COLUMN IF NOT EXISTS drink_id uuid NULL
    REFERENCES public.drinks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tally_gifts_drink_id
  ON public.tally_gifts(drink_id);
