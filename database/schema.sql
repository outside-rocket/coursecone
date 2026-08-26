-- =====================================================================
-- CourseCone — Academic DBMS DDL
-- EER mapping: PERSON superclass w/ Option-8A shared-PK specialization;
-- CLASS_OFFERING as weak entity of COURSE; multivalued slots decomposed.
-- =====================================================================

-- ---------- EER: PERSON superclass ----------
CREATE TABLE person (
    person_id     BIGSERIAL PRIMARY KEY,
    full_name     VARCHAR(120) NOT NULL,
    email         VARCHAR(120) UNIQUE NOT NULL
                  CHECK (email LIKE '%@vitstudent.ac.in'),
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Option 8A: subclasses share the superclass primary key
CREATE TABLE student (
    person_id  BIGINT PRIMARY KEY REFERENCES person(person_id) ON DELETE CASCADE,
    roll_no    VARCHAR(12) UNIQUE NOT NULL
               CHECK (roll_no ~ '^\d{2}[A-Z]{3}\d{4}$'),      -- 24BCE1568
    bio        TEXT
);

CREATE TABLE faculty (
    person_id  BIGINT PRIMARY KEY REFERENCES person(person_id) ON DELETE CASCADE,
    emp_no     INTEGER UNIQUE NOT NULL,                       -- 53616
    school     VARCHAR(10)                                    -- SCOPE / SENSE / SAS...
);

-- ---------- COURSE (strong entity) ----------
CREATE TABLE course (
    course_code     VARCHAR(12) PRIMARY KEY,
    course_title    VARCHAR(150) NOT NULL,
    course_type     VARCHAR(20) CHECK (course_type IN
                      ('Theory Only','Lab Only','Theory + Practical',
                       'Embedded Theory','Embedded Lab','Online Course',
                       'Soft Skill','Project','Studio')),
    l               SMALLINT DEFAULT 0 CHECK (l BETWEEN 0 AND 5),
    t               SMALLINT DEFAULT 0 CHECK (t BETWEEN 0 AND 5),
    p               SMALLINT DEFAULT 0 CHECK (p BETWEEN 0 AND 5),
    j               SMALLINT DEFAULT 0 CHECK (j BETWEEN 0 AND 5),
    credits         NUMERIC(3,1),
    course_category VARCHAR(60),        -- Discipline Core, Open Elective, ...
    course_option   VARCHAR(12)         -- Regular
);

-- ---------- SLOT master data ----------
CREATE TABLE slot_definitions (
    slot_token   VARCHAR(8) PRIMARY KEY,                 -- A1, TA1, L11, TCC1
    slot_type    VARCHAR(6) NOT NULL CHECK (slot_type IN ('THEORY','LAB')),
    day_of_week  VARCHAR(3) NOT NULL CHECK (day_of_week IN ('MON','TUE','WED','THU','FRI')),
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    CHECK (start_time < end_time)
);
CREATE INDEX idx_slot_day_start ON slot_definitions (day_of_week, start_time);   -- B+ tree

-- ---------- CLASS_OFFERING: weak entity of COURSE ----------
-- Identifying relationship: owner COURSE; discriminator class_id.
-- Composite PK {course_code, class_id}; ON DELETE CASCADE from owner.
CREATE TABLE class_offering (
    course_code  VARCHAR(12) NOT NULL REFERENCES course(course_code)
                 ON UPDATE CASCADE ON DELETE CASCADE,
    class_id     VARCHAR(20) NOT NULL CHECK (class_id ~ '^CH\d{13}$'),
    faculty_id   BIGINT NOT NULL REFERENCES faculty(person_id),
    venue        VARCHAR(20),                            -- AB3-505 or NIL
    semester_id  VARCHAR(10) NOT NULL,
    PRIMARY KEY (course_code, class_id)                          -- weak-entity PK
);
CREATE INDEX idx_class_course_faculty ON class_offering (course_code, faculty_id);

-- Multivalued slot attribute decomposed to satisfy 1NF/BCNF:
CREATE TABLE class_slot_breakdown (
    course_code VARCHAR(12) NOT NULL,
    class_id    VARCHAR(20) NOT NULL,
    slot_token  VARCHAR(8)  NOT NULL REFERENCES slot_definitions(slot_token)
                ON DELETE CASCADE,
    PRIMARY KEY (course_code, class_id, slot_token),
    FOREIGN KEY (course_code, class_id)
        REFERENCES class_offering(course_code, class_id) ON DELETE CASCADE
);
CREATE INDEX idx_breakdown_slot ON class_slot_breakdown (slot_token);

-- ---------- Enrollments ----------
CREATE TABLE enrollment (
    student_id  BIGINT NOT NULL REFERENCES student(person_id) ON DELETE CASCADE,
    course_code VARCHAR(12) NOT NULL,
    class_id    VARCHAR(20) NOT NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      VARCHAR(10) NOT NULL DEFAULT 'CONFIRMED'
                CHECK (status IN ('CONFIRMED','DROPPED')),
    PRIMARY KEY (student_id, course_code, class_id),
    FOREIGN KEY (course_code, class_id)
        REFERENCES class_offering(course_code, class_id) ON DELETE CASCADE
);

-- ---------- Social graph & chat ----------
CREATE TABLE user_follows (
    follower_id  BIGINT NOT NULL REFERENCES student(person_id) ON DELETE CASCADE,
    following_id BIGINT NOT NULL REFERENCES student(person_id) ON DELETE CASCADE,
    followed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

CREATE TABLE chat_messages (
    message_id   BIGSERIAL PRIMARY KEY,
    sender_id    BIGINT NOT NULL REFERENCES student(person_id) ON DELETE CASCADE,
    receiver_id  BIGINT NOT NULL REFERENCES student(person_id) ON DELETE CASCADE,
    message_text TEXT NOT NULL CHECK (length(message_text) BETWEEN 1 AND 2000),
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read      BOOLEAN NOT NULL DEFAULT false
);

-- ---------- Swap marketplace ----------
CREATE TABLE swap_listing (
    listing_id          BIGSERIAL PRIMARY KEY,
    student_id          BIGINT NOT NULL REFERENCES student(person_id) ON DELETE CASCADE,
    offered_course_code VARCHAR(12) NOT NULL,
    offered_class_id    VARCHAR(20) NOT NULL,
    desired_course_code VARCHAR(12) NOT NULL REFERENCES course(course_code),
    desired_slot_tokens TEXT[] NOT NULL DEFAULT '{}',
    status              VARCHAR(10) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN','PENDING','COMPLETED','CANCELLED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (offered_course_code, offered_class_id)
        REFERENCES class_offering(course_code, class_id) ON DELETE CASCADE
);
CREATE INDEX idx_listing_status ON swap_listing (status, desired_course_code);

CREATE TABLE swap_transaction (
    transaction_id      BIGSERIAL PRIMARY KEY,
    sender_id           BIGINT NOT NULL REFERENCES student(person_id),
    receiver_id         BIGINT NOT NULL REFERENCES student(person_id),
    sender_listing_id   BIGINT NOT NULL REFERENCES swap_listing(listing_id),
    receiver_listing_id BIGINT NOT NULL REFERENCES swap_listing(listing_id),
    status              VARCHAR(12) NOT NULL DEFAULT 'PROPOSED'
                        CHECK (status IN ('PROPOSED','ACCEPTED','COMPLETED','ROLLED_BACK')),
    executed_at         TIMESTAMPTZ
);

-- =====================================================================
-- ACID SWAP STORED PROCEDURE — strict Two-Phase Locking (2PL)
-- 1. exclusive row locks on both listings AND both students' enrollments
-- 2. verify no slot conflicts vs both students' post-swap schedules
-- 3. atomically exchange class mappings
-- 4. guaranteed atomicity: exception => full ROLLBACK
-- =====================================================================
CREATE OR REPLACE PROCEDURE execute_slot_swap(
    p_sender_listing   BIGINT,
    p_receiver_listing BIGINT,
    p_actor            BIGINT
) LANGUAGE plpgsql AS $$
DECLARE
    ls swap_listing; lr swap_listing;
BEGIN
    -- GROWING PHASE: acquire all exclusive locks before any write
    SELECT * INTO ls FROM swap_listing WHERE listing_id = p_sender_listing FOR UPDATE;
    SELECT * INTO lr FROM swap_listing WHERE listing_id = p_receiver_listing FOR UPDATE;
    IF ls.listing_id IS NULL OR lr.listing_id IS NULL THEN
        RAISE EXCEPTION 'listing not found';
    END IF;
    IF ls.student_id <> p_actor THEN RAISE EXCEPTION 'not your listing'; END IF;
    IF ls.status <> 'OPEN' OR lr.status <> 'OPEN' THEN
        RAISE EXCEPTION 'race detected: a listing is no longer OPEN';
    END IF;

    PERFORM 1 FROM enrollment WHERE student_id IN (ls.student_id, lr.student_id) FOR UPDATE;

    -- cross-check desires vs offers
    IF ls.desired_course_code <> lr.offered_course_code
       OR lr.desired_course_code <> ls.offered_course_code THEN
        RAISE EXCEPTION 'listings are not mutually compatible';
    END IF;

    -- conflict verification against both students' schedules after swap
    PERFORM 1
    FROM class_slot_breakdown nb                     -- sender receives receiver's class
    JOIN class_slot_breakdown ob ON ob.slot_token = nb.slot_token
         AND ob.course_code = ob.course_code
    WHERE nb.course_code = lr.offered_course_code AND nb.class_id = lr.offered_class_id
      AND EXISTS (SELECT 1 FROM enrollment e
                  WHERE e.student_id = ls.student_id
                    AND e.course_code = ob.course_code AND e.class_id = ob.class_id)
      AND NOT (ob.course_code = ls.offered_course_code AND ob.class_id = ls.offered_class_id)
    LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'slot conflict for sender'; END IF;

    -- SHRINKING PHASE: atomic exchange
    DELETE FROM enrollment
    WHERE (student_id = ls.student_id AND course_code = ls.offered_course_code
           AND class_id = ls.offered_class_id)
       OR (student_id = lr.student_id AND course_code = lr.offered_course_code
           AND class_id = lr.offered_class_id);

    INSERT INTO enrollment (student_id, course_code, class_id) VALUES
        (ls.student_id, lr.offered_course_code, lr.offered_class_id),
        (lr.student_id, ls.offered_course_code, ls.offered_class_id);

    UPDATE swap_listing SET status='COMPLETED'
     WHERE listing_id IN (p_sender_listing, p_receiver_listing);

    INSERT INTO swap_transaction (sender_id, receiver_id, sender_listing_id,
        receiver_listing_id, status, executed_at)
    VALUES (ls.student_id, lr.student_id, p_sender_listing, p_receiver_listing,
            'ACCEPTED', now());
END $$;

-- =====================================================================
-- THREE-SCHEMA ARCHITECTURE — external views
-- =====================================================================
CREATE VIEW v_public_peers AS                    -- External 1: privacy-preserving
SELECT s.person_id, s.roll_no, p.full_name,
       co.course_code, b.slot_token, c.course_title
FROM enrollment e
JOIN student s      ON s.person_id = e.student_id
JOIN person p       ON p.person_id = s.person_id
JOIN class_offering co ON co.course_code = e.course_code
                       AND co.class_id = e.class_id
LEFT JOIN class_slot_breakdown b ON b.course_code = co.course_code
                                AND b.class_id = co.class_id
LEFT JOIN course c ON c.course_code = co.course_code
WHERE e.status = 'CONFIRMED';
-- note: person.email/password_hash are structurally unreachable via this view

CREATE OR REPLACE VIEW v_timetable_grid AS       -- External 2: denormalized grid feed
SELECT e.student_id,
       sd.day_of_week, sd.start_time, sd.end_time, sd.slot_type, sd.slot_token,
       co.course_code, c.course_title, co.venue, f.emp_no, p.full_name AS faculty_name
FROM enrollment e
JOIN class_slot_breakdown b ON b.course_code = e.course_code
                           AND b.class_id = e.class_id
JOIN slot_definitions sd    ON sd.slot_token = b.slot_token
JOIN class_offering co      ON co.course_code = e.course_code
                           AND co.class_id = e.class_id
JOIN course c               ON c.course_code = co.course_code
JOIN faculty f              ON f.person_id = co.faculty_id
JOIN person p               ON p.person_id = f.person_id
WHERE e.status = 'CONFIRMED';
