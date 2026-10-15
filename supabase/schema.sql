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

-- 3b. LIGAS
CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_xp INTEGER NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 3c. CONFIGURACIÓN XP POR JUEGO
CREATE TABLE IF NOT EXISTS game_xp_configs (
  game_id TEXT PRIMARY KEY,
  base INTEGER NOT NULL DEFAULT 70,
  max_ref NUMERIC NOT NULL DEFAULT 100
);

-- 4. USUARIOS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL, display_name TEXT, display_name_anon TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student','teacher')),
  is_superadmin BOOLEAN DEFAULT false,
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
  role TEXT DEFAULT 'teacher' CHECK (role IN ('teacher')),
  is_superadmin BOOLEAN DEFAULT false,
  added_by TEXT, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
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
  criteria_mapping JSONB DEFAULT '{}',
  classroom_id TEXT, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS criteria_mapping JSONB DEFAULT '{}';
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
  class_id TEXT REFERENCES classes(id),
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
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::text
      AND is_superadmin = true
  );
$$;
CREATE OR REPLACE FUNCTION is_teacher() RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE (id = auth.uid()::text OR email = auth.jwt()->>'email')
      AND role = 'teacher'
  );
$$;
CREATE OR REPLACE FUNCTION public.sync_current_user_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_email TEXT := LOWER(auth.jwt()->>'email');
  v_name TEXT := COALESCE(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name', split_part(v_email, '@', 1));
  v_avatar TEXT := COALESCE(auth.jwt()->'user_metadata'->>'avatar_url', auth.jwt()->'user_metadata'->>'picture');
  v_profile RECORD;
  v_legacy RECORD;
  v_teacher_role TEXT;
  v_is_superadmin BOOLEAN := false;
  v_target_role TEXT;
BEGIN
  IF v_uid IS NULL OR v_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Determinar rol y superadmin
  SELECT role, COALESCE(is_superadmin, false) INTO v_teacher_role, v_is_superadmin
  FROM allowed_teachers WHERE LOWER(email) = v_email AND active = true;

  -- Perfil existente
  SELECT * INTO v_profile FROM users WHERE id = v_uid;

  IF v_is_superadmin = true OR (v_profile.id IS NOT NULL AND v_profile.is_superadmin = true) THEN
    v_target_role := 'teacher';
    v_is_superadmin := true;
  ELSIF v_teacher_role IS NOT NULL THEN
    v_target_role := 'teacher';
  ELSE
    v_target_role := 'student';
  END IF;

  -- 2. Buscar si existe fila legacy con este email (id != v_uid)
  SELECT * INTO v_legacy FROM users WHERE LOWER(email) = v_email AND id != v_uid LIMIT 1;

  IF v_legacy.id IS NOT NULL THEN
    -- Evitar colisión de clave única de email temporalmente
    UPDATE users SET email = 'migrated_' || id || '_' || email WHERE id = v_legacy.id;

    -- Crear o actualizar fila con v_uid
    IF v_profile.id IS NOT NULL THEN
      UPDATE users SET
        xp = GREATEST(COALESCE(users.xp, 0), COALESCE(v_legacy.xp, 0)),
        guild_id = COALESCE(users.guild_id, v_legacy.guild_id),
        logros = CASE 
                   WHEN users.logros IS NOT NULL AND jsonb_array_length(to_jsonb(users.logros)) > 0 THEN users.logros 
                   ELSE COALESCE(v_legacy.logros, '{}') 
                 END,
        display_name = COALESCE(users.display_name, v_legacy.display_name, v_name),
        display_name_anon = COALESCE(users.display_name_anon, v_legacy.display_name_anon),
        avatar = COALESCE(users.avatar, v_legacy.avatar, v_avatar),
        subject_id = COALESCE(users.subject_id, v_legacy.subject_id),
        is_superadmin = (users.is_superadmin = true OR v_legacy.is_superadmin = true OR v_is_superadmin = true),
        role = v_target_role
      WHERE id = v_uid;
    ELSE
      INSERT INTO users (
        id, email, display_name, display_name_anon, role, avatar, subject_id, guild_id, xp, logros, is_superadmin, created_at
      ) VALUES (
        v_uid,
        v_email,
        COALESCE(v_legacy.display_name, v_name),
        COALESCE(v_legacy.display_name_anon, 'Alumno ' || UPPER(SUBSTRING(v_name FROM 1 FOR 1))),
        v_target_role,
        COALESCE(v_legacy.avatar, v_avatar),
        v_legacy.subject_id,
        v_legacy.guild_id,
        COALESCE(v_legacy.xp, 0),
        COALESCE(v_legacy.logros, '{}'),
        (v_legacy.is_superadmin = true OR v_is_superadmin = true),
        COALESCE(v_legacy.created_at, NOW())
      );
    END IF;

    -- Migrar class_members
    INSERT INTO class_members (class_id, student_id, joined_at)
    SELECT cm.class_id, v_uid, cm.joined_at
    FROM class_members cm
    WHERE cm.student_id = v_legacy.id
    ON CONFLICT (class_id, student_id) DO NOTHING;
    DELETE FROM class_members WHERE student_id = v_legacy.id;

    -- Migrar registros de juegos y notas
    UPDATE game_results SET student_id = v_uid WHERE student_id = v_legacy.id;
    UPDATE topic_test_results SET student_id = v_uid WHERE student_id = v_legacy.id;
    UPDATE offline_grades SET student_id = v_uid WHERE student_id = v_legacy.id;
    UPDATE offline_grades SET graded_by = v_uid WHERE graded_by = v_legacy.id;
    UPDATE exam_results SET student_id = v_uid WHERE student_id = v_legacy.id;
    UPDATE classes SET teacher_id = v_uid WHERE teacher_id = v_legacy.id;
    UPDATE arena_bots SET owner_id = v_uid WHERE owner_id = v_legacy.id;
    UPDATE live_participants SET student_id = v_uid WHERE student_id = v_legacy.id;

    -- Eliminar registro legacy antiguo
    DELETE FROM users WHERE id = v_legacy.id;

    SELECT * INTO v_profile FROM users WHERE id = v_uid;
    RETURN to_jsonb(v_profile);
  END IF;

  -- 3. Si ya existe el perfil v_uid (sin legacy pendiente)
  IF v_profile.id IS NOT NULL THEN
    UPDATE users 
    SET role = v_target_role, 
        is_superadmin = v_is_superadmin,
        avatar = CASE 
          WHEN v_avatar IS NOT NULL AND (users.avatar IS NULL OR users.avatar LIKE '%bottts%') THEN v_avatar 
          ELSE users.avatar 
        END
    WHERE id = v_uid;

    SELECT * INTO v_profile FROM users WHERE id = v_uid;
    RETURN to_jsonb(v_profile);
  END IF;

  -- 4. Usuario completamente nuevo
  INSERT INTO users (
    id, email, display_name, display_name_anon, role, avatar, is_superadmin, created_at
  ) VALUES (
    v_uid,
    v_email,
    v_name,
    'Alumno ' || UPPER(SUBSTRING(v_name FROM 1 FOR 1)),
    v_target_role,
    v_avatar,
    v_is_superadmin,
    NOW()
  );

  SELECT * INTO v_profile FROM users WHERE id = v_uid;
  RETURN to_jsonb(v_profile);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_current_user_profile() TO authenticated;

-- Trigger para enlazar automáticamente usuarios de Google OAuth en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(NEW.email);
  v_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(v_email, '@', 1));
  v_avatar TEXT := NEW.raw_user_meta_data->>'avatar_url';
  v_teacher_role TEXT;
  v_is_superadmin BOOLEAN := false;
  v_target_role TEXT;
  v_legacy RECORD;
BEGIN
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role, COALESCE(is_superadmin, false) INTO v_teacher_role, v_is_superadmin
  FROM allowed_teachers WHERE LOWER(email) = v_email AND active = true;

  IF v_is_superadmin = true OR v_teacher_role IS NOT NULL THEN
    v_target_role := 'teacher';
  ELSE
    v_target_role := 'student';
  END IF;

  SELECT * INTO v_legacy FROM users WHERE LOWER(email) = v_email AND id != NEW.id::text LIMIT 1;

  IF v_legacy.id IS NOT NULL THEN
    UPDATE users SET email = 'migrated_' || id || '_' || email WHERE id = v_legacy.id;

    INSERT INTO users (
      id, email, display_name, display_name_anon, role, avatar, subject_id, guild_id, xp, logros, is_superadmin, created_at
    ) VALUES (
      NEW.id::text,
      v_email,
      COALESCE(v_legacy.display_name, v_name),
      COALESCE(v_legacy.display_name_anon, 'Alumno ' || UPPER(SUBSTRING(v_name FROM 1 FOR 1))),
      v_target_role,
      COALESCE(v_legacy.avatar, v_avatar),
      v_legacy.subject_id,
      v_legacy.guild_id,
      COALESCE(v_legacy.xp, 0),
      COALESCE(v_legacy.logros, '{}'),
      (v_legacy.is_superadmin = true OR v_is_superadmin = true),
      COALESCE(v_legacy.created_at, NOW())
    );

    INSERT INTO class_members (class_id, student_id, joined_at)
    SELECT cm.class_id, NEW.id::text, cm.joined_at
    FROM class_members cm
    WHERE cm.student_id = v_legacy.id
    ON CONFLICT (class_id, student_id) DO NOTHING;
    DELETE FROM class_members WHERE student_id = v_legacy.id;

    UPDATE game_results SET student_id = NEW.id::text WHERE student_id = v_legacy.id;
    UPDATE topic_test_results SET student_id = NEW.id::text WHERE student_id = v_legacy.id;
    UPDATE offline_grades SET student_id = NEW.id::text WHERE student_id = v_legacy.id;
    UPDATE offline_grades SET graded_by = NEW.id::text WHERE graded_by = v_legacy.id;
    UPDATE exam_results SET student_id = NEW.id::text WHERE student_id = v_legacy.id;
    UPDATE classes SET teacher_id = NEW.id::text WHERE teacher_id = v_legacy.id;
    UPDATE arena_bots SET owner_id = NEW.id::text WHERE owner_id = v_legacy.id;
    UPDATE live_participants SET student_id = NEW.id::text WHERE student_id = v_legacy.id;

    DELETE FROM users WHERE id = v_legacy.id;
    RETURN NEW;
  END IF;

  INSERT INTO users (
    id, email, display_name, display_name_anon, role, avatar, is_superadmin, created_at
  ) VALUES (
    NEW.id::text,
    v_email,
    v_name,
    'Alumno ' || UPPER(SUBSTRING(v_name FROM 1 FOR 1)),
    v_target_role,
    v_avatar,
    v_is_superadmin,
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_superadmin = (users.is_superadmin = true OR EXCLUDED.is_superadmin = true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

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
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_xp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_read"  ON subjects FOR SELECT USING (true);
CREATE POLICY "subjects_write" ON subjects FOR ALL    USING (is_admin());
CREATE POLICY "guilds_read"    ON guilds   FOR SELECT USING (true);
CREATE POLICY "guilds_write"   ON guilds   FOR ALL    USING (is_admin());
CREATE POLICY "medals_read"    ON medals   FOR SELECT USING (true);
CREATE POLICY "medals_write"   ON medals   FOR ALL    USING (is_admin());
CREATE POLICY "leagues_read"   ON leagues  FOR SELECT USING (true);
CREATE POLICY "leagues_write"  ON leagues  FOR ALL    USING (is_admin());
CREATE POLICY "game_xp_configs_read"  ON game_xp_configs FOR SELECT USING (true);
CREATE POLICY "game_xp_configs_write" ON game_xp_configs FOR ALL    USING (is_admin());

CREATE POLICY "users_read"   ON users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (auth.uid()::text = id);
CREATE POLICY "users_update" ON users FOR UPDATE USING (auth.uid()::text = id OR is_admin());
CREATE POLICY "users_delete" ON users FOR DELETE USING (is_admin());

CREATE POLICY "allowed_teachers_read"  ON allowed_teachers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allowed_teachers_write" ON allowed_teachers FOR ALL    USING (is_admin());
CREATE POLICY "allowed_students_read"  ON allowed_students FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allowed_students_write" ON allowed_students FOR ALL    USING (is_teacher());

CREATE POLICY "classes_read"   ON classes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "classes_insert" ON classes FOR INSERT WITH CHECK (is_teacher());
CREATE POLICY "classes_update" ON classes FOR UPDATE USING (teacher_id = auth.uid()::text OR is_admin());
CREATE POLICY "classes_delete" ON classes FOR DELETE USING (teacher_id = auth.uid()::text OR is_admin());

CREATE POLICY "class_members_read"   ON class_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "class_members_insert" ON class_members FOR INSERT WITH CHECK (student_id = auth.uid()::text OR is_teacher());
CREATE POLICY "class_members_delete" ON class_members FOR DELETE USING (student_id = auth.uid()::text OR is_teacher());

CREATE POLICY "assignments_read"  ON assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "assignments_write" ON assignments FOR ALL    USING (is_teacher());

CREATE POLICY "topics_read"  ON topics FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "topics_write" ON topics FOR ALL    USING (is_admin());
CREATE POLICY "topic_questions_read"  ON topic_questions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "topic_questions_write" ON topic_questions FOR ALL    USING (is_teacher());

CREATE POLICY "test_results_read"   ON topic_test_results FOR SELECT USING (student_id = auth.uid()::text OR is_teacher());
CREATE POLICY "test_results_insert" ON topic_test_results FOR INSERT WITH CHECK (student_id = auth.uid()::text);
CREATE POLICY "test_results_update" ON topic_test_results FOR UPDATE USING (is_teacher());

CREATE POLICY "exam_questions_read"  ON exam_questions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "exam_questions_write" ON exam_questions FOR ALL    USING (is_teacher());
CREATE POLICY "exams_read"  ON exams FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "exams_write" ON exams FOR ALL    USING (is_teacher());
CREATE POLICY "exam_results_read"   ON exam_results FOR SELECT USING (student_id = auth.uid()::text OR is_teacher());
CREATE POLICY "exam_results_insert" ON exam_results FOR INSERT WITH CHECK (student_id = auth.uid()::text);
CREATE POLICY "exam_results_update" ON exam_results FOR UPDATE USING (is_teacher());

CREATE POLICY "game_results_read"   ON game_results FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "game_results_insert" ON game_results FOR INSERT WITH CHECK (student_id = auth.uid()::text OR is_teacher());
CREATE POLICY "game_results_update" ON game_results FOR UPDATE USING (is_admin());

CREATE POLICY "live_all"          ON live_sessions    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "participants_all"  ON live_participants FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "mecano_read"  ON mecanoclass_texts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mecano_write" ON mecanoclass_texts FOR ALL    USING (is_teacher());

CREATE POLICY "bots_read"   ON arena_bots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bots_insert" ON arena_bots FOR INSERT WITH CHECK (owner_id = auth.uid()::text);
CREATE POLICY "bots_update" ON arena_bots FOR UPDATE USING (owner_id = auth.uid()::text OR is_admin());
CREATE POLICY "bots_delete" ON arena_bots FOR DELETE USING (owner_id = auth.uid()::text OR is_admin());

CREATE POLICY "offline_tasks_read"   ON offline_tasks  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "offline_tasks_write"  ON offline_tasks  FOR ALL    USING (is_teacher());
CREATE POLICY "offline_grades_read"  ON offline_grades FOR SELECT USING (student_id = auth.uid()::text OR is_teacher());
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
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- ═══════════════════════════════════════════════════════════════════════
-- MOTOR DE GAMIFICACIÓN EN POSTGRESQL (TRIGGERS DE XP Y MEDALLAS)
-- Cada inserción en game_results, topic_test_results o exam_results
-- evalúa automáticamente el XP ganado y las medallas desbloqueadas.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Función para calcular XP de un juego
CREATE OR REPLACE FUNCTION fn_calculate_game_xp(
  p_game_id TEXT,
  p_score NUMERIC,
  p_student_id TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_base INTEGER := 80;
  v_max_ref NUMERIC := 500;
  v_ratio NUMERIC;
  v_score_factor NUMERIC;
  v_score_xp INTEGER;
  v_n_partidas INTEGER;
  v_prev_max NUMERIC := 0;
  v_prev_score_factor NUMERIC;
  v_prev_score_xp INTEGER;
BEGIN
  IF p_score IS NULL OR p_score <= 0 THEN
    RETURN 5; -- XP base por jugar
  END IF;

  -- Configuración de referencia por juego
  CASE p_game_id
    WHEN 'netdefender'  THEN v_base := 80;  v_max_ref := 800;
    WHEN 'trivial'      THEN v_base := 50;  v_max_ref := 100;
    WHEN 'mecanoclass'  THEN v_base := 80;  v_max_ref := 100;
    WHEN 'rompecodigos' THEN v_base := 100; v_max_ref := 1000;
    WHEN 'helados'      THEN v_base := 90;  v_max_ref := 500;
    WHEN 'moon'         THEN v_base := 70;  v_max_ref := 300;
    WHEN 'arenabots'    THEN v_base := 100; v_max_ref := 200;
    WHEN 'cybersmith'   THEN v_base := 90;  v_max_ref := 500;
    WHEN 'asimov'       THEN v_base := 60;  v_max_ref := 100;
    WHEN 'appflow'      THEN v_base := 70;  v_max_ref := 300;
    WHEN 'cc_trivial'   THEN v_base := 80;  v_max_ref := 10;
    WHEN 'cert_arcade'  THEN v_base := 100; v_max_ref := 500;
    WHEN 'hex_invaders' THEN v_base := 100; v_max_ref := 1000;
    WHEN 'kanban_hero'  THEN v_base := 100; v_max_ref := 200;
    WHEN 'databreach'   THEN v_base := 100; v_max_ref := 5;
    ELSE                     v_base := 70;  v_max_ref := 100;
  END CASE;

  v_ratio := LEAST(2.0, p_score / GREATEST(1.0, v_max_ref));
  v_score_factor := power(v_ratio, 0.65);
  v_score_xp := round(v_base * v_score_factor);

  -- Comprobar partidas anteriores
  SELECT COUNT(*), COALESCE(MAX(score), 0)
  INTO v_n_partidas, v_prev_max
  FROM game_results
  WHERE student_id = p_student_id AND game_id = p_game_id AND forced_fail = false;

  IF v_n_partidas <= 1 THEN
    RETURN GREATEST(5, 5 + v_score_xp);
  ELSE
    IF p_score > v_prev_max THEN
      v_prev_score_factor := power(LEAST(2.0, v_prev_max / GREATEST(1.0, v_max_ref)), 0.65);
      v_prev_score_xp := round(v_base * v_prev_score_factor);
      RETURN GREATEST(5, 5 + GREATEST(0, v_score_xp - v_prev_score_xp));
    ELSE
      RETURN 5; -- XP base de repetición
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Función evaluadora de medallas y actualización atómica de usuario
CREATE OR REPLACE FUNCTION fn_process_gamification(
  p_student_id TEXT,
  p_xp_to_add INTEGER,
  p_event_type TEXT,    -- 'game', 'topic_test', 'exam'
  p_event_id TEXT,      -- game_id, topic_id, exam_id
  p_score NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_user RECORD;
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_current_logros TEXT[];
  v_new_logros TEXT[] := '{}';
  v_medal_xp_bonus INTEGER := 0;
  v_hour INTEGER;
  v_minute INTEGER;
  v_dow INTEGER;
BEGIN
  -- Obtener usuario actual con bloqueo para concurrencia segura
  SELECT * INTO v_user FROM users WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_current_xp := COALESCE(v_user.xp, 0);
  v_current_logros := COALESCE(v_user.logros, '{}');
  v_new_xp := v_current_xp + GREATEST(0, p_xp_to_add);

  -- Hora local peninsular (Madrid)
  v_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Madrid');
  v_minute := EXTRACT(MINUTE FROM now() AT TIME ZONE 'Europe/Madrid');
  v_dow := EXTRACT(DOW FROM now() AT TIME ZONE 'Europe/Madrid'); -- 0 = Domingo, 6 = Sábado

  -- A) MEDALLAS DE PROGRESIÓN POR XP
  IF v_new_xp >= 500 AND NOT ('novato' = ANY(v_current_logros)) THEN
    v_new_logros := array_append(v_new_logros, 'novato');
    v_medal_xp_bonus := v_medal_xp_bonus + 100;
  END IF;
  IF v_new_xp >= 2000 AND NOT ('aprendiz' = ANY(v_current_logros)) THEN
    v_new_logros := array_append(v_new_logros, 'aprendiz');
    v_medal_xp_bonus := v_medal_xp_bonus + 200;
  END IF;
  IF v_new_xp >= 5000 AND NOT ('veterano' = ANY(v_current_logros)) THEN
    v_new_logros := array_append(v_new_logros, 'veterano');
    v_medal_xp_bonus := v_medal_xp_bonus + 500;
  END IF;
  IF v_new_xp >= 15000 AND NOT ('maestro_xp' = ANY(v_current_logros)) THEN
    v_new_logros := array_append(v_new_logros, 'maestro_xp');
    v_medal_xp_bonus := v_medal_xp_bonus + 1000;
  END IF;
  IF v_new_xp >= 30000 AND NOT ('cibernauta' = ANY(v_current_logros)) THEN
    v_new_logros := array_append(v_new_logros, 'cibernauta');
    v_medal_xp_bonus := v_medal_xp_bonus + 1500;
  END IF;
  IF v_new_xp >= 100000 AND NOT ('leyenda' = ANY(v_current_logros)) THEN
    v_new_logros := array_append(v_new_logros, 'leyenda');
    v_medal_xp_bonus := v_medal_xp_bonus + 2000;
  END IF;

  -- B) MEDALLAS DE TIEMPO (Saludables)
  -- ¡IMPORTANTE! Solo se otorgan si la actividad la realiza el alumno directamente en tiempo real ('game' o 'topic_test').
  -- Las correcciones docentes de tareas offline ('offline_task'), exámenes ('exam') u operaciones de profesor
  -- NUNCA deben otorgar medallas de horario.
  IF p_event_type IN ('game', 'topic_test') THEN
    -- 1. El Madrugador: 7:00 a 8:59 AM
    IF v_hour >= 7 AND v_hour <= 8 AND NOT ('madrugador' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'madrugador');
      v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;
    -- 2. Repaso Vespertino: 20:00 a 21:59 h
    IF v_hour >= 20 AND v_hour < 22 AND NOT ('repaso_nocturno' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'repaso_nocturno');
      v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;
    -- 3. Fin de semana
    IF (v_dow = 0 OR v_dow = 6) AND NOT ('finde' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'finde');
      v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;
  END IF;

  -- C) MEDALLAS POR EVENTO
  IF p_event_type = 'game' THEN
    -- Primera partida
    IF NOT ('first_blood' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'first_blood');
      v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;
    IF NOT ('primer_circuito' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'primer_circuito');
      v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;

    -- NetDefender
    IF p_event_id = 'netdefender' THEN
      IF p_score >= 300 AND NOT ('netdefender_300' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'netdefender_300'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 500 AND NOT ('guardian_red' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'guardian_red'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 700 AND NOT ('netdefender_700' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'netdefender_700'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 1000 AND NOT ('netdefender_1000' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'netdefender_1000'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- MecanoClass
    ELSIF p_event_id = 'mecanoclass' THEN
      IF p_score >= 20 AND NOT ('mecanoclass_20' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'mecanoclass_20'); v_medal_xp_bonus := v_medal_xp_bonus + 20;
      END IF;
      IF p_score >= 40 AND NOT ('mecanografo' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'mecanografo'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 60 AND NOT ('mecanoclass_60' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'mecanoclass_60'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 70 AND NOT ('velocista' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'velocista'); v_medal_xp_bonus := v_medal_xp_bonus + 120;
      END IF;
      IF p_score >= 100 AND NOT ('mecanoclass_100' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'mecanoclass_100'); v_medal_xp_bonus := v_medal_xp_bonus + 250;
      END IF;
    -- RompeCódigos
    ELSIF p_event_id = 'rompecodigos' THEN
      IF p_score >= 200 AND NOT ('rompecodigos_200' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'rompecodigos_200'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 500 AND NOT ('rompecodigos_500' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'rompecodigos_500'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 800 AND NOT ('criptologo' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'criptologo'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 1200 AND NOT ('rompecodigos_1200' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'rompecodigos_1200'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- H3L4D0S
    ELSIF p_event_id = 'helados' THEN
      IF p_score >= 500 AND NOT ('helados_500' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'helados_500'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 1000 AND NOT ('helados_1000' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'helados_1000'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 1500 AND NOT ('helados_1500' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'helados_1500'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 2000 AND NOT ('helados_2000' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'helados_2000'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
      IF p_score >= 2500 AND NOT ('helados_2500' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'helados_2500'); v_medal_xp_bonus := v_medal_xp_bonus + 250;
      END IF;
      IF p_score >= 3000 AND NOT ('helados_3000' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'helados_3000'); v_medal_xp_bonus := v_medal_xp_bonus + 300;
      END IF;
      IF p_score >= 35000 AND NOT ('helados_35000' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'helados_35000'); v_medal_xp_bonus := v_medal_xp_bonus + 1000;
      END IF;
    -- Hex Invaders
    ELSIF p_event_id = 'hex_invaders' THEN
      IF p_score >= 200 AND NOT ('matematico' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'matematico'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 1000 AND NOT ('overflow' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'overflow'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- Kanban Hero
    ELSIF p_event_id = 'kanban_hero' THEN
      IF p_score >= 50 AND NOT ('agilista' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'agilista'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 150 AND NOT ('productividad_extrema' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'productividad_extrema'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- Cert Arcade
    ELSIF p_event_id = 'cert_arcade' THEN
      IF p_score >= 50 AND NOT ('burocrata' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'burocrata'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 100 AND NOT ('perfeccionista' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'perfeccionista'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 500 AND NOT ('ciudadano_ejemplar' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'ciudadano_ejemplar'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- Databreach
    ELSIF p_event_id = 'databreach' THEN
      IF p_score >= 50 AND NOT ('hacker_novato' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'hacker_novato'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 250 AND NOT ('mr_robot' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'mr_robot'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- CC Trivial
    ELSIF p_event_id = 'cc_trivial' THEN
      IF p_score >= 5 AND NOT ('abogado_novato' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'abogado_novato'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 10 AND NOT ('juez_supremo' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'juez_supremo'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
      IF p_score >= 10 AND NOT ('perfeccionista' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'perfeccionista'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
    -- MOON
    ELSIF p_event_id = 'moon' THEN
      IF p_score >= 1 AND NOT ('astronauta' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'astronauta'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 3 AND NOT ('moon_3' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'moon_3'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 5 AND NOT ('explorador_lunar' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'explorador_lunar'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 10 AND NOT ('moon_10' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'moon_10'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 15 AND NOT ('moon_15' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'moon_15'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- ArenaBots
    ELSIF p_event_id = 'arenabots' THEN
      IF p_score >= 50 AND NOT ('arenabots_50' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'arenabots_50'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 100 AND NOT ('arenabots_100' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'arenabots_100'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 150 AND NOT ('arenabots_150' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'arenabots_150'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 250 AND NOT ('arquitecto_bot' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'arquitecto_bot'); v_medal_xp_bonus := v_medal_xp_bonus + 250;
      END IF;
    -- CyberSmith
    ELSIF p_event_id = 'cybersmith' THEN
      IF p_score >= 100 AND NOT ('cybersmith_100' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'cybersmith_100'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 250 AND NOT ('cybersmith_250' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'cybersmith_250'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 400 AND NOT ('ingeniero' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'ingeniero'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 600 AND NOT ('cybersmith_600' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'cybersmith_600'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- Asimov
    ELSIF p_event_id = 'asimov' THEN
      IF p_score >= 20 AND NOT ('asimov_20' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'asimov_20'); v_medal_xp_bonus := v_medal_xp_bonus + 30;
      END IF;
      IF p_score >= 50 AND NOT ('asimov_50' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'asimov_50'); v_medal_xp_bonus := v_medal_xp_bonus + 60;
      END IF;
      IF p_score >= 80 AND NOT ('leyes_robotica' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'leyes_robotica'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 100 AND NOT ('asimov_100' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'asimov_100'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
    -- AppFlow
    ELSIF p_event_id = 'appflow' THEN
      IF p_score >= 50 AND NOT ('appflow_50' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'appflow_50'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
      END IF;
      IF p_score >= 100 AND NOT ('appflow_100' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'appflow_100'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
      IF p_score >= 200 AND NOT ('unicornio' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'unicornio'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 300 AND NOT ('appflow_300' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'appflow_300'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
      END IF;
    -- Trivial
    ELSIF p_event_id = 'trivial' THEN
      IF p_score >= 30 AND NOT ('trivial_30' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'trivial_30'); v_medal_xp_bonus := v_medal_xp_bonus + 30;
      END IF;
      IF p_score >= 60 AND NOT ('trivial_60' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'trivial_60'); v_medal_xp_bonus := v_medal_xp_bonus + 60;
      END IF;
      IF p_score >= 100 AND NOT ('sabiondo' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'sabiondo'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
      END IF;
    END IF;

  ELSIF p_event_type = 'topic_test' THEN
    IF p_score >= 5 AND NOT ('raton_biblioteca' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'raton_biblioteca'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
    END IF;
    IF p_score >= 5 AND NOT ('primer_examen' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'primer_examen'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;
    IF p_score >= 9 AND p_score < 10 AND NOT ('casi_perfecto' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'casi_perfecto'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
    END IF;
    IF p_score >= 10 AND NOT ('maestro_teoria' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'maestro_teoria'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
    END IF;
    IF p_score >= 10 AND NOT ('perfeccionista' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'perfeccionista'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
    END IF;

    -- Medallas temáticas por bloque
    IF p_event_id IN ('topic_multimedia', 'block1') THEN
      IF p_score >= 5 AND NOT ('experto_multimedia' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'experto_multimedia'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 9 AND NOT ('experto_multimedia_oro' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'experto_multimedia_oro'); v_medal_xp_bonus := v_medal_xp_bonus + 300;
      END IF;
    ELSIF p_event_id IN ('topic_cms', 'block4') THEN
      IF p_score >= 5 AND NOT ('maestro_cms' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'maestro_cms'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 9 AND NOT ('maestro_cms_oro' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'maestro_cms_oro'); v_medal_xp_bonus := v_medal_xp_bonus + 300;
      END IF;
    ELSIF p_event_id IN ('topic_cyber', 'block3') THEN
      IF p_score >= 5 AND NOT ('sysadmin' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'sysadmin'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 9 AND NOT ('sysadmin_oro' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'sysadmin_oro'); v_medal_xp_bonus := v_medal_xp_bonus + 300;
      END IF;
    ELSIF p_event_id IN ('topic_html', 'topic_js', 'block2') THEN
      IF p_score >= 5 AND NOT ('dev_web' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'dev_web'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 9 AND NOT ('dev_web_oro' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'dev_web_oro'); v_medal_xp_bonus := v_medal_xp_bonus + 300;
      END IF;
    ELSIF p_event_id IN ('topic_kanban', 'block5') THEN
      IF p_score >= 5 AND NOT ('kanban_master' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'kanban_master'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
      END IF;
      IF p_score >= 9 AND NOT ('kanban_master_oro' = ANY(v_current_logros)) THEN
        v_new_logros := array_append(v_new_logros, 'kanban_master_oro'); v_medal_xp_bonus := v_medal_xp_bonus + 300;
      END IF;
    END IF;

  ELSIF p_event_type = 'exam' THEN
    IF NOT ('primer_examen' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'primer_examen'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;
    IF p_score >= 5 AND NOT ('aprobado_teoria' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'aprobado_teoria'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
    END IF;
    IF p_score = 5 AND NOT ('por_los_pelos' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'por_los_pelos'); v_medal_xp_bonus := v_medal_xp_bonus + 50;
    END IF;
    IF p_score >= 8.5 AND p_score < 9.5 AND NOT ('casi_perfecto' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'casi_perfecto'); v_medal_xp_bonus := v_medal_xp_bonus + 100;
    END IF;
    IF p_score >= 9.5 AND NOT ('maestro_teoria' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'maestro_teoria'); v_medal_xp_bonus := v_medal_xp_bonus + 200;
    END IF;
    IF p_score >= 10 AND NOT ('perfeccionista' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'perfeccionista'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
    END IF;
  ELSIF p_event_type = 'offline_task' THEN
    IF p_score >= 10 AND NOT ('perfeccionista' = ANY(v_current_logros)) THEN
      v_new_logros := array_append(v_new_logros, 'perfeccionista'); v_medal_xp_bonus := v_medal_xp_bonus + 150;
    END IF;
  END IF;

  -- Actualizar usuario de forma atómica
  v_new_xp := v_new_xp + v_medal_xp_bonus;

  IF array_length(v_new_logros, 1) > 0 THEN
    UPDATE users
    SET xp = v_new_xp,
        logros = array_cat(v_current_logros, v_new_logros),
        updated_at = now()
    WHERE id = p_student_id;
  ELSE
    UPDATE users
    SET xp = v_new_xp,
        updated_at = now()
    WHERE id = p_student_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Triggers de Bienestar Digital (máximo 5 partidas / tests al día para alumnos)

CREATE OR REPLACE FUNCTION trg_check_game_digital_wellbeing()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
  v_count INTEGER;
  v_hour INTEGER;
BEGIN
  SELECT role INTO v_user_role FROM users WHERE id = NEW.student_id;

  IF v_user_role = 'student' THEN
    -- 1. Horario de descanso nocturno: de 23:00 a 07:00 (hora peninsular de Madrid)
    v_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Madrid');
    IF v_hour >= 23 OR v_hour < 7 THEN
      RAISE EXCEPTION 'Bienestar Digital: Horario de descanso escolar (23:00 a 07:00). ¡Es hora de dormir y descansar! 🌙😴';
    END IF;

    -- 2. Límite diario de 5 partidas
    SELECT COUNT(*) INTO v_count
    FROM game_results
    WHERE student_id = NEW.student_id
      AND game_id = NEW.game_id
      AND (created_at AT TIME ZONE 'Europe/Madrid')::date = (now() AT TIME ZONE 'Europe/Madrid')::date;

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Bienestar Digital: Has alcanzado el límite máximo de 5 partidas diarias para este juego.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_game_result_insert ON game_results;
CREATE TRIGGER trg_before_game_result_insert
BEFORE INSERT ON game_results
FOR EACH ROW EXECUTE FUNCTION trg_check_game_digital_wellbeing();

CREATE OR REPLACE FUNCTION trg_check_test_digital_wellbeing()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
  v_count INTEGER;
  v_hour INTEGER;
BEGIN
  SELECT role INTO v_user_role FROM users WHERE id = NEW.student_id;

  IF v_user_role = 'student' THEN
    -- 1. Horario de descanso nocturno: de 23:00 a 07:00 (hora peninsular de Madrid)
    v_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Madrid');
    IF v_hour >= 23 OR v_hour < 7 THEN
      RAISE EXCEPTION 'Bienestar Digital: Horario de descanso escolar (23:00 a 07:00). ¡Es hora de dormir y descansar! 🌙😴';
    END IF;

    -- 2. Límite diario de 5 intentos
    SELECT COUNT(*) INTO v_count
    FROM topic_test_results
    WHERE student_id = NEW.student_id
      AND topic_id = NEW.topic_id
      AND (created_at AT TIME ZONE 'Europe/Madrid')::date = (now() AT TIME ZONE 'Europe/Madrid')::date;

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Bienestar Digital: Has alcanzado el límite máximo de 5 intentos diarios para este test.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_topic_test_insert ON topic_test_results;
CREATE TRIGGER trg_before_topic_test_insert
BEFORE INSERT ON topic_test_results
FOR EACH ROW EXECUTE FUNCTION trg_check_test_digital_wellbeing();

-- 4. Triggers para cada tabla de resultados

-- A) Trigger para game_results
CREATE OR REPLACE FUNCTION trg_game_results_gamify() RETURNS TRIGGER AS $$
DECLARE
  v_xp_earned INTEGER;
BEGIN
  IF NEW.forced_fail = true THEN
    RETURN NEW;
  END IF;

  v_xp_earned := fn_calculate_game_xp(NEW.game_id, NEW.score, NEW.student_id);
  PERFORM fn_process_gamification(NEW.student_id, v_xp_earned, 'game', NEW.game_id, NEW.score);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_game_result_insert ON game_results;
CREATE TRIGGER trg_after_game_result_insert
AFTER INSERT ON game_results
FOR EACH ROW EXECUTE FUNCTION trg_game_results_gamify();

-- B) Trigger para topic_test_results (Tests de repaso)
CREATE OR REPLACE FUNCTION trg_topic_test_gamify() RETURNS TRIGGER AS $$
DECLARE
  v_xp_earned INTEGER := 10;
BEGIN
  IF NEW.forced_fail = true THEN
    RETURN NEW;
  END IF;

  IF NEW.score >= 5 THEN
    v_xp_earned := round(NEW.score * 10);
  END IF;

  PERFORM fn_process_gamification(NEW.student_id, v_xp_earned, 'topic_test', NEW.topic_id, NEW.score);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_topic_test_insert ON topic_test_results;
CREATE TRIGGER trg_after_topic_test_insert
AFTER INSERT ON topic_test_results
FOR EACH ROW EXECUTE FUNCTION trg_topic_test_gamify();

-- C) Trigger para exam_results (Exámenes oficiales)
CREATE OR REPLACE FUNCTION trg_exam_results_gamify() RETURNS TRIGGER AS $$
DECLARE
  v_xp_earned INTEGER := 20;
BEGIN
  IF NEW.forced_fail = true THEN
    RETURN NEW;
  END IF;

  IF NEW.score >= 5 THEN
    v_xp_earned := round(NEW.score * 20);
  END IF;

  PERFORM fn_process_gamification(NEW.student_id, v_xp_earned, 'exam', NEW.exam_id, NEW.score);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_exam_result_insert ON exam_results;
CREATE TRIGGER trg_after_exam_result_insert
AFTER INSERT ON exam_results
FOR EACH ROW EXECUTE FUNCTION trg_exam_results_gamify();

-- D) Trigger para offline_grades (Tareas y prácticas offline calificadas por el docente)
CREATE OR REPLACE FUNCTION trg_offline_grades_gamify() RETURNS TRIGGER AS $$
DECLARE
  v_xp_earned INTEGER := 0;
  v_prev_xp INTEGER := 0;
  v_diff_xp INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.score IS NOT NULL AND NEW.score >= 0 THEN
      v_xp_earned := round(NEW.score * 15);
      PERFORM fn_process_gamification(NEW.student_id, v_xp_earned, 'offline_task', NEW.task_id, NEW.score);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.score IS DISTINCT FROM OLD.score THEN
      v_xp_earned := round(COALESCE(NEW.score, 0) * 15);
      v_prev_xp := round(COALESCE(OLD.score, 0) * 15);
      v_diff_xp := v_xp_earned - v_prev_xp;
      IF v_diff_xp != 0 THEN
        PERFORM fn_process_gamification(NEW.student_id, v_diff_xp, 'offline_task', NEW.task_id, NEW.score);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_offline_grade_gamify ON offline_grades;
CREATE TRIGGER trg_after_offline_grade_gamify
AFTER INSERT OR UPDATE ON offline_grades
FOR EACH ROW EXECUTE FUNCTION trg_offline_grades_gamify();


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
