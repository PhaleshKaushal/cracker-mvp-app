-- ============================================================
-- CRACKER MVP — Supabase Schema
-- Run this entire file in Supabase → SQL Editor → Run
-- ============================================================

-- Opening cards (shown 1-2 random per session as warm-up)
CREATE TABLE opening_cards (
  id          SERIAL PRIMARY KEY,
  card_number INTEGER NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Passages (constitutional law text)
CREATE TABLE passages (
  id          SERIAL PRIMARY KEY,
  article     TEXT NOT NULL,         -- e.g. "Article 14"
  title       TEXT NOT NULL,         -- e.g. "Right to Equality"
  content     TEXT NOT NULL,         -- full passage text
  order_index INTEGER NOT NULL,      -- sequential display order
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Questions (MCQs linked to passages)
CREATE TABLE questions (
  id              SERIAL PRIMARY KEY,
  passage_id      INTEGER REFERENCES passages(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  correct_nudge   TEXT NOT NULL,     -- shown after correct answer
  explanation     TEXT NOT NULL,     -- shown after 2 wrong attempts (wrong_nudge)
  order_index     INTEGER NOT NULL,  -- question order within passage
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Study sessions (one per passage per user visit)
CREATE TABLE study_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  passage_id      INTEGER REFERENCES passages(id),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  read_time_s     INTEGER,           -- seconds spent reading
  is_complete     BOOLEAN DEFAULT FALSE
);

-- Answers (one row per question attempt)
CREATE TABLE answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question_id     INTEGER REFERENCES questions(id),
  passage_id      INTEGER REFERENCES passages(id),
  selected_option CHAR(1) CHECK (selected_option IN ('a','b','c','d')),
  is_correct      BOOLEAN NOT NULL,
  attempt_number  INTEGER NOT NULL CHECK (attempt_number IN (1,2)),
  answered_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_cards ENABLE ROW LEVEL SECURITY;

-- Passages and questions are public read
CREATE POLICY "Public read passages" ON passages FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read opening_cards" ON opening_cards FOR SELECT USING (true);

-- Users can only see and write their own data
CREATE POLICY "Own profile only" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Own sessions only" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Own answers only" ON answers
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
