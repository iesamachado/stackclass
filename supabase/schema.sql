-- ═══════════════════════════════════════════════════════════════════════
--  STACKCLASS — Esquema PostgreSQL (Supabase)
--  Ejecutar completo en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ASIGNATURAS
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT DEFAULT '📚',
  color TEXT DEFAULT '#6c63ff', description TEXT, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. GREMIOS (por asignatura)
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT NOT NULL, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, icon TEXT, color TEXT, image_url TEXT, description TEXT,
  PRIMARY KEY (id, subject_id)
);

-- 3. MEDALLAS (por asignatura)
CREATE TABLE IF NOT EXISTS medals (
  id TEXT NOT NULL, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, icon TEXT, xp_value INTEGER DEFAULT 0,
  public BOOLEAN DEFAULT true,
  PRIMARY KEY (id, subject_id)
);

-- 4. USUARIOS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL, display_name TEXT, display_name_anon TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  avatar TEXT, subject_id TEXT REFERENCES subjects(id), guild_id TEXT,
  xp INTEGER DEFAULT 0, logros TEXT[] DEFAULT '{}',
  digital_wellbeing JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. AUTORIZADOS
CREATE TABLE IF NOT EXISTS allowed_teachers (
  email TEXT PRIMARY KEY, name TEXT, subject_id TEXT REFERENCES subjects(id),
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS allowed_students (
  email TEXT PRIMARY KEY, allowed BOOLEAN DEFAULT true, recovered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CLASES
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  name TEXT NOT NULL, level TEXT, pin TEXT UNIQUE,
  enabled_games TEXT[] DEFAULT '{}', enabled_topics TEXT[] DEFAULT '{}',
  classroom_id TEXT, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. MEMBRESÍAS
CREATE TABLE IF NOT EXISTS class_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, student_id)
);

-- 8. TAREAS CLASSROOM
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  game_id TEXT, title TEXT NOT NULL, description TEXT,
  due_date TIMESTAMPTZ, max_score INTEGER DEFAULT 100, classroom_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TEMARIO
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, icon TEXT, color TEXT,
  sort_order INTEGER DEFAULT 0, blocks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER topics_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 10. PREGUNTAS TEST TEORÍA
CREATE TABLE IF NOT EXISTS topic_questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  enunciado TEXT NOT NULL, opciones JSONB NOT NULL DEFAULT '[]',
  ce TEXT, criterio TEXT, dificultad TEXT CHECK (dificultad IN ('baja','media','alta')),
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. RESULTADOS TEST TEORÍA
CREATE TABLE IF NOT EXISTS topic_test_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  score NUMERIC(5,2), raw_score NUMERIC(5,2), max_possible INTEGER,
  respuestas JSONB NOT NULL DEFAULT '[]', forced_fail BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. BANCO DE PREGUNTAS EXAMEN
CREATE TABLE IF NOT EXISTS exam_questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  enunciado TEXT NOT NULL, opciones JSONB NOT NULL DEFAULT '[]',
  ce TEXT, criterio TEXT, dificultad TEXT,
  created_by TEXT REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. EXÁMENES OFICIALES
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  title TEXT, question_ids TEXT[] NOT NULL DEFAULT '{}',
  duration_mins INTEGER DEFAULT 45, active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS exam_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  score NUMERIC(5,2), raw_score NUMERIC(5,2),
  respuestas JSONB NOT NULL DEFAULT '[]', forced_fail BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. RESULTADOS JUEGOS
CREATE TABLE IF NOT EXISTS game_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  game_id TEXT NOT NULL, score NUMERIC(10,2), duration_secs INTEGER,
  metadata JSONB DEFAULT '{}', forced_fail BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. SESIONES EN VIVO
CREATE TABLE IF NOT EXISTS live_sessions (
  pin TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES users(id),
  game_id TEXT NOT NULL, class_id TEXT REFERENCES classes(id),
  status TEXT DEFAULT 'lobby' CHECK (status IN ('lobby','running','finished')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER live_sessions_updated_at BEFORE UPDATE ON live_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS live_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_pin TEXT NOT NULL REFERENCES live_sessions(pin) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  display_name TEXT, score NUMERIC(10,2) DEFAULT 0, progress NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
  metadata JSONB DEFAULT '{}', joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_pin, student_id)
);

-- 16. TEXTOS MECANOGRAFÍA
CREATE TABLE IF NOT EXISTS mecanoclass_texts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT, content TEXT NOT NULL, difficulty TEXT,
  created_by TEXT REFERENCES users(id), active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. BOTS ARENABOTS
CREATE TABLE IF NOT EXISTS arena_bots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT NOT NULL, wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0, public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER arena_bots_updated_at BEFORE UPDATE ON arena_bots FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 18. TAREAS OFFLINE
CREATE TABLE IF NOT EXISTS offline_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, rubric JSONB, max_score NUMERIC(5,2) DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS offline_grades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES offline_tasks(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  score NUMERIC(5,2), feedback TEXT, graded_by TEXT REFERENCES users(id),
  graded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (task_id, student_id)
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_class_members_student  ON class_members(student_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class    ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_game_results_student   ON game_results(student_id);
CREATE INDEX IF NOT EXISTS idx_game_results_class     ON game_results(class_id);
CREATE INDEX IF NOT EXISTS idx_game_results_game      ON game_results(game_id);
CREATE INDEX IF NOT EXISTS idx_topic_test_student     ON topic_test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_topic_questions_topic  ON topic_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_live_participants_pin  ON live_participants(session_pin);
CREATE INDEX IF NOT EXISTS idx_users_subject          ON users(subject_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher        ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_subject        ON classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject         ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_game_results_subject   ON game_results(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class      ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_arena_bots_owner       ON arena_bots(owner_id);

-- FUNCIONES RLS
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text OR email = auth.jwt()->>'email' AND (role='admin' OR email='bernatcosta@iesamachado.org'));
$$;
CREATE OR REPLACE FUNCTION is_teacher() RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT is_admin() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text OR email = auth.jwt()->>'email' AND role IN ('teacher','admin'));
$$;

-- RLS POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mecanoclass_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE medals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_read"  ON subjects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "subjects_write" ON subjects FOR ALL    USING (is_admin());
CREATE POLICY "guilds_read"    ON guilds   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "guilds_write"   ON guilds   FOR ALL    USING (is_admin());
CREATE POLICY "medals_read"    ON medals   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "medals_write"   ON medals   FOR ALL    USING (is_admin());

CREATE POLICY "users_read"   ON users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update" ON users FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "users_delete" ON users FOR DELETE USING (is_admin());

CREATE POLICY "allowed_teachers_read"  ON allowed_teachers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allowed_teachers_write" ON allowed_teachers FOR ALL    USING (is_admin());
CREATE POLICY "allowed_students_read"  ON allowed_students FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allowed_students_write" ON allowed_students FOR ALL    USING (is_teacher());

CREATE POLICY "classes_read"   ON classes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "classes_insert" ON classes FOR INSERT WITH CHECK (is_teacher());
CREATE POLICY "classes_update" ON classes FOR UPDATE USING (teacher_id = auth.uid() OR is_admin());
CREATE POLICY "classes_delete" ON classes FOR DELETE USING (teacher_id = auth.uid() OR is_admin());

CREATE POLICY "class_members_read"   ON class_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "class_members_insert" ON class_members FOR INSERT WITH CHECK (student_id = auth.uid() OR is_teacher());
CREATE POLICY "class_members_delete" ON class_members FOR DELETE USING (student_id = auth.uid() OR is_teacher());

CREATE POLICY "assignments_read"  ON assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "assignments_write" ON assignments FOR ALL    USING (is_teacher());

CREATE POLICY "topics_read"  ON topics FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "topics_write" ON topics FOR ALL    USING (is_admin());
CREATE POLICY "topic_questions_read"  ON topic_questions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "topic_questions_write" ON topic_questions FOR ALL    USING (is_teacher());

CREATE POLICY "test_results_read"   ON topic_test_results FOR SELECT USING (student_id = auth.uid() OR is_teacher());
CREATE POLICY "test_results_insert" ON topic_test_results FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "test_results_update" ON topic_test_results FOR UPDATE USING (is_teacher());

CREATE POLICY "exam_questions_read"  ON exam_questions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "exam_questions_write" ON exam_questions FOR ALL    USING (is_teacher());
CREATE POLICY "exams_read"  ON exams FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "exams_write" ON exams FOR ALL    USING (is_teacher());
CREATE POLICY "exam_results_read"   ON exam_results FOR SELECT USING (student_id = auth.uid() OR is_teacher());
CREATE POLICY "exam_results_insert" ON exam_results FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "exam_results_update" ON exam_results FOR UPDATE USING (is_teacher());

CREATE POLICY "game_results_read"   ON game_results FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "game_results_insert" ON game_results FOR INSERT WITH CHECK (student_id = auth.uid() OR is_teacher());
CREATE POLICY "game_results_update" ON game_results FOR UPDATE USING (is_admin());

CREATE POLICY "live_all"          ON live_sessions    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "participants_all"  ON live_participants FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "mecano_read"  ON mecanoclass_texts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mecano_write" ON mecanoclass_texts FOR ALL    USING (is_teacher());

CREATE POLICY "bots_read"   ON arena_bots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bots_insert" ON arena_bots FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "bots_update" ON arena_bots FOR UPDATE USING (owner_id = auth.uid() OR is_admin());
CREATE POLICY "bots_delete" ON arena_bots FOR DELETE USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "offline_tasks_read"   ON offline_tasks  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "offline_tasks_write"  ON offline_tasks  FOR ALL    USING (is_teacher());
CREATE POLICY "offline_grades_read"  ON offline_grades FOR SELECT USING (student_id = auth.uid() OR is_teacher());
CREATE POLICY "offline_grades_write" ON offline_grades FOR ALL    USING (is_teacher());

-- VISTAS
CREATE OR REPLACE VIEW class_ranking AS
SELECT best.class_id, best.student_id, u.display_name, u.display_name_anon, u.avatar, u.guild_id, u.xp,
  SUM(best.score) AS total_game_score, COUNT(DISTINCT best.game_id) AS games_played
FROM (
  SELECT DISTINCT ON (student_id, game_id, class_id) student_id, game_id, class_id, score
  FROM game_results WHERE forced_fail = false
  ORDER BY student_id, game_id, class_id, score DESC
) best
JOIN users u ON u.id = best.student_id
GROUP BY best.class_id, best.student_id, u.display_name, u.display_name_anon, u.avatar, u.guild_id, u.xp;

CREATE OR REPLACE VIEW student_test_history AS
SELECT r.*, t.name AS topic_name, t.icon AS topic_icon, t.color AS topic_color
FROM topic_test_results r JOIN topics t ON t.id = r.topic_id;

CREATE OR REPLACE VIEW student_topic_progress AS
SELECT student_id, topic_id, subject_id, MAX(score) AS best_score,
  COUNT(*) AS attempts, MIN(created_at) AS first_attempt, MAX(created_at) AS last_attempt
FROM topic_test_results WHERE forced_fail = false
GROUP BY student_id, topic_id, subject_id;

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE live_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE arena_bots;

-- ═══════════════════════════════════════════════════════════════════════
-- SUPABASE STORAGE: BUCKET PUBLICO assets
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'assets_public_read'
  ) THEN
    CREATE POLICY "assets_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'assets_insert_all'
  ) THEN
    CREATE POLICY "assets_insert_all" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'assets');
  END IF;
END $$;
