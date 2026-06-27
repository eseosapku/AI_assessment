-- Add image / diagram support to Recall cards (run after add-recall-tables.sql)
ALTER TABLE recall_cards
  ADD COLUMN IF NOT EXISTS front_image_url TEXT,
  ADD COLUMN IF NOT EXISTS front_diagram_svg TEXT;
