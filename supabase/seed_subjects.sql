-- ═══════════════════════════════════════════════════════════════════════
--  STACKCLASS — Seed Subjects, Guilds & Medals
-- ═══════════════════════════════════════════════════════════════════════

-- 1. ASIGNATURAS
INSERT INTO subjects (id, name, icon, color, description) VALUES
  ('tic2', 'Tecnologías de la Información y Comunicación II', '💻', '#0073aa', '2º Bachillerato — Desarrollo web, ciberseguridad, programación y metodologías ágiles'),
  ('cyr', 'Computación y Robótica', '🤖', '#6c63ff', '1º a 3º ESO — Alfabetización digital, programación por bloques, robótica, IA y ciberseguridad')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color, description = EXCLUDED.description;

-- 2. GREMIOS TIC2
INSERT INTO guilds (id, subject_id, name, icon, color, image_url, description) VALUES

ON CONFLICT (id, subject_id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color, description = EXCLUDED.description;

-- 3. GREMIOS CyR
INSERT INTO guilds (id, subject_id, name, icon, color, image_url, description) VALUES

ON CONFLICT (id, subject_id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color, description = EXCLUDED.description;

-- 4. MEDALLAS TIC2
INSERT INTO medals (id, subject_id, name, description, icon, xp_value, public) VALUES

ON CONFLICT (id, subject_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon;

-- 5. MEDALLAS CyR
INSERT INTO medals (id, subject_id, name, description, icon, xp_value, public) VALUES

ON CONFLICT (id, subject_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, xp_value = EXCLUDED.xp_value;

