# CourseCone — ER Diagrams (Mermaid)

## Full EER Diagram

```mermaid
erDiagram
    PERSON ||--o| STUDENT : "specializes (shared PK)"
    PERSON ||--o| FACULTY : "specializes (shared PK)"
    COURSE ||--|{ CLASS_OFFERING : "identifying (weak entity)"
    CLASS_OFFERING |o--o{ CLASS_SLOT_BREAKDOWN : "has"
    SLOT_DEFINITIONS ||--o{ CLASS_SLOT_BREAKDOWN : "token"
    STUDENT ||--o{ ENROLLMENT : "enrolls in"
    CLASS_OFFERING ||--o{ ENROLLMENT : "receives"
    STUDENT ||--o{ USER_FOLLOWS : "follows"
    STUDENT ||--o{ SWAP_LISTING : "lists"
    CLASS_OFFERING ||--o{ SWAP_LISTING : "offered class"
    COURSE ||--o{ SWAP_LISTING : "desired course"
    STUDENT ||--o{ SWAP_TRANSACTION : "sender"
    STUDENT ||--o{ SWAP_TRANSACTION : "receiver"
    SWAP_LISTING ||--o{ SWAP_TRANSACTION : "sender listing"
    SWAP_LISTING ||--o{ SWAP_TRANSACTION : "receiver listing"
    STUDENT }o--o{ CHAT_MESSAGES : "sends / receives"

    PERSON {
        BIGINT person_id PK
        VARCHAR full_name
        VARCHAR email UK "must be @vitstudent.ac.in"
        VARCHAR password_hash
        TIMESTAMPTZ created_at
    }
    STUDENT {
        BIGINT person_id PK_FK
        VARCHAR roll_no UK "regex ^\d{2}[A-Z]{3}\d{4}$"
        TEXT bio
    }
    FACULTY {
        BIGINT person_id PK_FK
        INTEGER emp_no UK
        VARCHAR school
    }
    COURSE {
        VARCHAR course_code PK
        VARCHAR course_title
        VARCHAR course_type "CHECK enum"
        SMALLINT l "0-5"
        SMALLINT t "0-5"
        SMALLINT p "0-5"
        SMALLINT j "0-5"
        NUMERIC credits
        VARCHAR course_category
        VARCHAR course_option
    }
    SLOT_DEFINITIONS {
        VARCHAR slot_token PK
        VARCHAR slot_type "THEORY/LAB"
        VARCHAR day_of_week "MON-FRI"
        TIME start_time
        TIME end_time "start < end"
    }
    CLASS_OFFERING {
        VARCHAR course_code PK_FK
        VARCHAR class_id PK "regex ^CH\d{13}$"
        BIGINT faculty_id FK
        VARCHAR venue
        VARCHAR semester_id
    }
    CLASS_SLOT_BREAKDOWN {
        VARCHAR course_code PK_FK
        VARCHAR class_id PK_FK
        VARCHAR slot_token PK_FK
    }
    ENROLLMENT {
        BIGINT student_id PK_FK
        VARCHAR course_code PK_FK
        VARCHAR class_id PK_FK
        TIMESTAMPTZ enrolled_at
        VARCHAR status "CONFIRMED/DROPPED"
    }
    USER_FOLLOWS {
        BIGINT follower_id PK_FK
        BIGINT following_id PK_FK "cannot follow self"
        TIMESTAMPTZ followed_at
    }
    CHAT_MESSAGES {
        BIGINT message_id PK
        BIGINT sender_id FK
        BIGINT receiver_id FK
        TEXT message_text "1-2000 chars"
        TIMESTAMPTZ sent_at
        BOOLEAN is_read
    }
    SWAP_LISTING {
        BIGINT listing_id PK
        BIGINT student_id FK
        VARCHAR offered_course_code FK
        VARCHAR offered_class_id FK
        VARCHAR desired_course_code FK
        TEXTARRAY desired_slot_tokens
        VARCHAR status "OPEN/PENDING/COMPLETED/CANCELLED"
        TIMESTAMPTZ created_at
    }
    SWAP_TRANSACTION {
        BIGINT transaction_id PK
        BIGINT sender_id FK
        BIGINT receiver_id FK
        BIGINT sender_listing_id FK
        BIGINT receiver_listing_id FK
        VARCHAR status "PROPOSED/ACCEPTED/COMPLETED/ROLLED_BACK"
        TIMESTAMPTZ executed_at
    }
```

## Simplified Overview

```mermaid
erDiagram
    PERSON ||--o| STUDENT : ""
    PERSON ||--o| FACULTY : ""
    COURSE ||--|{ CLASS_OFFERING : ""
    CLASS_OFFERING ||--o{ CLASS_SLOT_BREAKDOWN : ""
    SLOT_DEFINITIONS ||--o{ CLASS_SLOT_BREAKDOWN : ""
    STUDENT ||--o{ ENROLLMENT : ""
    CLASS_OFFERING ||--o{ ENROLLMENT : ""
    STUDENT ||--o{ USER_FOLLOWS : ""
    STUDENT ||--|| CHAT_MESSAGES : ""
    STUDENT ||--o{ SWAP_LISTING : ""
    SWAP_LISTING ||--o{ SWAP_TRANSACTION : ""

    PERSON { BIGINT person_id PK }
    STUDENT { VARCHAR roll_no UK }
    FACULTY { INTEGER emp_no UK }
    COURSE { VARCHAR course_code PK }
    CLASS_OFFERING { VARCHAR course_code PK VARCHAR class_id PK }
    SLOT_DEFINITIONS { VARCHAR slot_token PK }
    CLASS_SLOT_BREAKDOWN { VARCHAR slot_token PK_FK }
    ENROLLMENT { BIGINT student_id PK_FK VARCHAR course_code PK_FK VARCHAR class_id PK_FK }
    SWAP_LISTING { BIGINT listing_id PK }
    SWAP_TRANSACTION { BIGINT transaction_id PK }
```
