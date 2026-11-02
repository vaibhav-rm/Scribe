-- ============================================================================
-- Scribe — Seed Data
# ============================================================================
# Optional seed data for local development. Safe to re-run (idempotent).

-- Sample college
insert into public.colleges (name, normalized_name, location, verification_status)
values
  ('Birla Institute of Technology and Science, Pilani', 'bits-pilani', 'Pilani, Rajasthan', 'verified'),
  ('Manipal Institute of Technology', 'manipal-institute-of-technology', 'Manipal, Karnataka', 'verified'),
  ('College of Engineering, Pune', 'coe-pune', 'Pune, Maharashtra', 'verified')
on conflict (normalized_name) do nothing;

-- Sample departments
insert into public.departments (college_id, name, normalized_name)
select c.id, 'Computer Science Engineering', 'computer-science-engineering'
from public.colleges c where c.normalized_name = 'bits-pilani'
on conflict (college_id, normalized_name) do nothing;

insert into public.departments (college_id, name, normalized_name)
select c.id, 'Electrical and Electronics Engineering', 'electrical-electronics-engineering'
from public.colleges c where c.normalized_name = 'bits-pilani'
on conflict (college_id, normalized_name) do nothing;

-- A system template (owner_id null) for project synopsis
insert into public.templates (owner_id, title, description, document_type, academic_year, visibility, verification_status)
select null, 'Standard Project Synopsis', 'Default synopsis template used across colleges.', 'project_synopsis', null, 'public', 'verified'
where not exists (
  select 1 from public.templates where title = 'Standard Project Synopsis' and document_type = 'project_synopsis'
);
