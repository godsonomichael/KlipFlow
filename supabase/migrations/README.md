# Supabase migrations

This directory is reserved for additive Supabase migrations.

The recovered KlipFlow archive did not include the original migration SQL files. Do not infer or recreate destructive migrations from the TypeScript helpers alone. Before applying schema changes, inspect the existing Supabase project and add timestamped SQL migrations that preserve legacy tables and data, including `clipper_os_campaigns` if present.
