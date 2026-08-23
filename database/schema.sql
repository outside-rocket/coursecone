-- =====================================================================
-- CampusPeer — Complete PostgreSQL DDL (BCNF/3NF, EER-mapped)
-- =====================================================================

-- ---------- Core entities ----------
CREATE TABLE students (
    student_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_no        VARCHAR(20) UNIQUE NOT NULL,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(120) UNIQUE NOT NULL CHECK (email LIKE '%@vitstudent.ac.in'),
    password_hash  VARCHAR(255) NOT NULL,
    bio            TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
    course_code     VARCHAR(12) PRIMARY KEY,
    course_title    VARCHAR(150) NOT NULL,
    credits         SMALLINT CHECK (credits BETWEEN 0 AND 10),
    course_category VARCHAR(30)          -- UGEE / PC / PE / UE / ...
);

CREATE TABLE faculty (
    faculty_id   INTEGER PRIMARY KEY,             -- e.g. 53616
    faculty_name VARCHAR(120) NOT NULL
);

CREATE TABLE slot_definitions (
    slot_token   VARCHAR(8) PRIMARY KEY,           -- 'A1','TA1','L11'
    slot_type    VARCHAR(6) NOT NULL CHECK (slot_type IN ('THEORY','LAB')),
    day_of_week  VARCHAR(3) NOT NULL CHECK (day_of_week IN ('MON','TUE','WED','THU','FRI')),
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    CHECK (start_time < end_time)
);
CREATE INDEX idx_slot_day_start ON slot_definitions (day_of_week, start_time);

CREATE TABLE class_offerings (
    class_id    VARCHAR(30) PRIMARY KEY,            -- e.g. CH2026270100945
    course_code VARCHAR(12) NOT NULL REFERENCES courses(course_code) ON UPDATE CASCADE,
    faculty_id  INTEGER     NOT NULL REFERENCES faculty(faculty_id) ON UPDATE CASCADE,
    venue       VARCHAR(20),                        -- e.g. AB3-505
    semester_id VARCHAR(10) NOT NULL                -- e.g. F2025-26
);
-- B+ tree composite index for fast classmate/swap lookups
CREATE INDEX idx_class_course_faculty ON class_offerings (course_code, faculty_id);

CREATE TABLE class_slot_mapping (
    class_id   VARCHAR(30) NOT NULL REFERENCES class_offerings(class_id) ON DELETE CASCADE,
    slot_token VARCHAR(8)  NOT NULL REFERENCES slot_definitions(slot_token) ON DELETE CASCADE,
    PRIMARY KEY (class_id, slot_token)
);
CREATE INDEX idx_csm_slot ON class_slot_mapping (slot_token);

CREATE TABLE student_enrollments (
    student_id  UUID        NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    class_id    VARCHAR(30) NOT NULL REFERENCES class_offerings(class_id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      VARCHAR(10) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','DROPPED')),
    PRIMARY KEY (student_id, class_id)
);

-- ---------- Social graph & messaging ----------
CREATE TABLE user_follows (
    follower_id  UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    followed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_following ON user_follows (following_id);

CREATE TABLE chat_messages (
    message_id   BIGSERIAL PRIMARY KEY,
    sender_id    UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    receiver_id  UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    message_text TEXT NOT NULL CHECK (length(message_text) BETWEEN 1 AND 2000),
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_chat_conv ON chat_messages (sender_id, receiver_id, sent_at DESC);

-- ---------- FFCS swap marketplace ----------
CREATE TABLE slot_swap_listings (
    listing_id          BIGSERIAL PRIMARY KEY,
    student_id          UUID        NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    offered_class_id    VARCHAR(30) NOT NULL REFERENCES class_offerings(class_id) ON DELETE CASCADE,
    desired_course_code VARCHAR(12) NOT NULL REFERENCES courses(course_code),
    desired_slot_tokens TEXT[]      NOT NULL DEFAULT '{}',   -- acceptable alternatives
    status              VARCHAR(10) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN','PENDING','COMPLETED','CANCELLED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_listings_status ON slot_swap_listings (status, desired_course_code);

CREATE TABLE swap_transactions (
    transaction_id      BIGSERIAL PRIMARY KEY,
    sender_id           UUID NOT NULL REFERENCES students(student_id),
    receiver_id         UUID NOT NULL REFERENCES students(student_id),
    sender_listing_id   BIGINT NOT NULL REFERENCES slot_swap_listings(listing_id),
    receiver_listing_id BIGINT NOT NULL REFERENCES slot_swap_listings(listing_id),
    status              VARCHAR(12) NOT NULL DEFAULT 'PROPOSED'
                        CHECK (status IN ('PROPOSED','ACCEPTED','COMPLETED','ROLLED_BACK'))
);

-- =====================================================================
-- TRIGGER: overlap validation before inserting an enrollment
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_no_slot_clash() RETURNS trigger AS $$
DECLARE
    clash INT;
BEGIN
    SELECT 1 INTO clash
    FROM class_slot_mapping m_new
    JOIN slot_definitions s_new ON s_new.slot_token = m_new.slot_token
    JOIN student_enrollments se
         ON se.student_id = NEW.student_id AND se.status = 'CONFIRMED'
    JOIN class_slot_mapping m_old ON m_old.class_id = se.class_id
    JOIN slot_definitions s_old ON s_old.slot_token = m_old.slot_token
    WHERE m_new.class_id = NEW.class_id
      AND s_new.day_of_week = s_old.day_of_week
      AND s_new.start_time < s_old.end_time
      AND s_new.end_time   > s_old.start_time
    LIMIT 1;

    IF clash IS NOT NULL THEN
        RAISE EXCEPTION 'Slot conflict: class % overlaps existing enrollment', NEW.class_id;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER enroll_overlap_check
BEFORE INSERT ON student_enrollments
FOR EACH ROW EXECUTE FUNCTION trg_no_slot_clash();

-- =====================================================================
-- VIEWS (three-schema separation: hides contact/roll data)
-- =====================================================================
CREATE VIEW v_public_classmates AS
SELECT  se1.student_id                       AS student_a,
        se2.student_id                       AS student_b,
        co.course_code,
        csm.slot_token,
        string_agg(DISTINCT f.faculty_name, ', ') AS faculty
FROM student_enrollments se1
JOIN student_enrollments se2
     ON se1.class_id = se2.class_id AND se1.student_id <> se2.student_id
JOIN class_offerings co ON co.class_id = se1.class_id
JOIN class_slot_mapping csm ON csm.class_id = se1.class_id
JOIN faculty f ON f.faculty_id = co.faculty_id
WHERE se1.status = 'CONFIRMED' AND se2.status = 'CONFIRMED';

CREATE VIEW v_student_weekly_grid AS
SELECT se.student_id,
       sd.day_of_week,
       sd.start_time,
       sd.end_time,
       sd.slot_type,
       sd.slot_token,
       c.course_title,
       co.course_code,
       co.venue,
       f.faculty_name
FROM student_enrollments se
JOIN class_slot_mapping csm ON csm.class_id = se.class_id
JOIN slot_definitions sd    ON sd.slot_token = csm.slot_token
JOIN class_offerings co     ON co.class_id = se.class_id
JOIN courses c              ON c.course_code = co.course_code
JOIN faculty f              ON f.faculty_id = co.faculty_id
WHERE se.status = 'CONFIRMED';

-- =====================================================================
-- ACID SWAP with 2PL row-level locking (prevents double-claim)
-- Execute inside a single transaction:
-- =====================================================================
-- BEGIN;
--   SELECT * FROM slot_swap_listings WHERE listing_id IN (:a, :b) FOR UPDATE;
--   -- validate both OPEN, courses match each other's offers/desires
--   UPDATE student_enrollments ... (exchange class_ids both directions)
--   UPDATE slot_swap_listings SET status='COMPLETED' WHERE listing_id IN (:a,:b);
--   INSERT INTO swap_transactions(...) VALUES (...,'ACCEPTED');
-- COMMIT;
