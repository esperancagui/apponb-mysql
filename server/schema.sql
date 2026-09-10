-- onb. — MySQL schema (port of the Firestore data model)
--
-- Column names deliberately match the camelCase keys the app already reads/writes
-- (workspaceId, createdAt, ...) so `SELECT *` with a DictCursor returns the exact
-- dict shape the routes and Pydantic schemas already expect. `users` keeps its
-- existing snake_case fields. No ORM, no migration tool — this file is the
-- single source of truth, loaded once by MySQL's docker-entrypoint-initdb.d.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS onb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE onb;

-- ── users ────────────────────────────────────────────────────────────────────
-- `firebase_uid` keeps its name (now just a locally-generated opaque id) so the
-- ~40 call sites that key off it, and the client's `firebase_uid` field, don't
-- need renaming.
CREATE TABLE users (
    id                      CHAR(36)      NOT NULL PRIMARY KEY,
    firebase_uid            VARCHAR(64)   NOT NULL,
    email                   VARCHAR(255)  NOT NULL,
    password_hash           VARCHAR(255)  NULL,
    display_name            VARCHAR(255)  NULL,
    photo_url               VARCHAR(1024) NULL,
    disabled                TINYINT(1)    NOT NULL DEFAULT 0,
    created_at              DATETIME(6)   NOT NULL,
    plan                    VARCHAR(20)   NOT NULL DEFAULT 'free',
    subscription_status     VARCHAR(20)   NULL,
    trial_end               DATETIME(6)   NULL,
    current_period_end      DATETIME(6)   NULL,
    stripe_customer_id      VARCHAR(255)  NULL,
    stripe_subscription_id  VARCHAR(255)  NULL,
    email_notifications     TINYINT(1)    NOT NULL DEFAULT 1,
    language                VARCHAR(10)   NOT NULL DEFAULT 'pt-BR',
    deleted                 TINYINT(1)    NOT NULL DEFAULT 0,
    deleted_at              DATETIME(6)   NULL,
    UNIQUE KEY uq_users_firebase_uid (firebase_uid),
    KEY ix_users_email_deleted (email, deleted),
    KEY ix_users_stripe_customer (stripe_customer_id),
    KEY ix_users_stripe_subscription (stripe_subscription_id)
) ENGINE=InnoDB;

-- ── password_resets ──────────────────────────────────────────────────────────
-- New — the Firebase-hosted reset page is gone, so the server issues its own token.
CREATE TABLE password_resets (
    token       CHAR(64)     NOT NULL PRIMARY KEY,
    user_id     CHAR(36)     NOT NULL,
    expires_at  DATETIME(6)  NOT NULL,
    used_at     DATETIME(6)  NULL,
    created_at  DATETIME(6)  NOT NULL,
    KEY ix_password_resets_user (user_id),
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── token_blacklist ──────────────────────────────────────────────────────────
CREATE TABLE token_blacklist (
    jti         VARCHAR(64)  NOT NULL PRIMARY KEY,
    expires_at  DATETIME(6)  NOT NULL,
    KEY ix_token_blacklist_expires (expires_at)
) ENGINE=InnoDB;

-- ── trial_fingerprints ───────────────────────────────────────────────────────
CREATE TABLE trial_fingerprints (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    fingerprint   VARCHAR(255) NOT NULL,
    firebase_uid  VARCHAR(64)  NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    KEY ix_trial_fingerprints_fp (fingerprint)
) ENGINE=InnoDB;

-- ── workspaces ───────────────────────────────────────────────────────────────
CREATE TABLE workspaces (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NULL,
    ownerId     VARCHAR(64)  NOT NULL,
    plan        VARCHAR(20)  NOT NULL DEFAULT 'free',
    brandColor  VARCHAR(20)  NULL,
    logoUrl     VARCHAR(1024) NULL,
    createdAt   DATETIME(6)  NOT NULL,
    KEY ix_workspaces_owner (ownerId)
) ENGINE=InnoDB;

-- ── workspace_members ────────────────────────────────────────────────────────
-- Replaces the `members/` subcollection AND the `users.workspaceIds` array that
-- was kept in sync by hand (ArrayUnion/ArrayRemove) in three different places.
CREATE TABLE workspace_members (
    workspaceId  CHAR(36)     NOT NULL,
    uid          VARCHAR(64)  NOT NULL,
    role         VARCHAR(20)  NOT NULL DEFAULT 'member',
    PRIMARY KEY (workspaceId, uid),
    KEY ix_workspace_members_uid (uid),
    CONSTRAINT fk_workspace_members_ws FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── forms ────────────────────────────────────────────────────────────────────
CREATE TABLE forms (
    id               CHAR(36)     NOT NULL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    slug             VARCHAR(255) NOT NULL,
    clientName       VARCHAR(255) NULL,
    templateId       VARCHAR(64)  NULL,
    category         VARCHAR(100) NULL,
    `groups`         JSON         NULL,
    branding         JSON         NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'draft',
    folderId         CHAR(36)     NULL,
    workspaceId      CHAR(36)     NOT NULL,
    ownerId          VARCHAR(64)  NOT NULL,
    submissionCount  INT          NOT NULL DEFAULT 0,
    createdAt        DATETIME(6)  NOT NULL,
    updatedAt        DATETIME(6)  NOT NULL,
    UNIQUE KEY uq_forms_slug (slug),
    KEY ix_forms_workspace_created (workspaceId, createdAt),
    KEY ix_forms_owner_status (ownerId, status),
    KEY ix_forms_status_updated (status, updatedAt),
    CONSTRAINT fk_forms_workspace FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── submissions ──────────────────────────────────────────────────────────────
-- FK is SET NULL (not CASCADE): delete_form snapshots formName/clientName/
-- formGroups onto every submission first, so responses survive form deletion.
-- Two FKs on purpose, with different actions: deleting a *form* only detaches it
-- (formId -> NULL) so the response survives (delete_form snapshots formName/
-- clientName/formGroups onto the row first); deleting a *workspace* removes its
-- submissions outright via the workspaceId cascade, matching the old hand-rolled
-- cascade in firestore_db.delete_workspace.
CREATE TABLE submissions (
    id                CHAR(36)     NOT NULL PRIMARY KEY,
    formId            CHAR(36)     NULL,
    workspaceId       CHAR(36)     NULL,
    data              JSON         NOT NULL,
    files             JSON         NULL,
    submittedAt       DATETIME(6)  NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'new',
    aiAnalysisStatus  VARCHAR(20)  NULL,
    aiInsightId       CHAR(36)     NULL,
    formName          VARCHAR(255) NULL,
    clientName        VARCHAR(255) NULL,
    formGroups        JSON         NULL,
    KEY ix_submissions_form_submitted (formId, submittedAt),
    KEY ix_submissions_workspace_submitted (workspaceId, submittedAt),
    CONSTRAINT fk_submissions_form FOREIGN KEY (formId) REFERENCES forms(id) ON DELETE SET NULL,
    CONSTRAINT fk_submissions_workspace FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── insights ─────────────────────────────────────────────────────────────────
CREATE TABLE insights (
    id                      CHAR(36)    NOT NULL PRIMARY KEY,
    submissionId            CHAR(36)    NOT NULL,
    formId                  CHAR(36)    NULL,
    headerImpacto           JSON        NOT NULL,
    diagnosticoEstrategico  JSON        NOT NULL,
    scoreONB                JSON        NOT NULL,
    redFlagsEstrategicas    JSON        NOT NULL,
    perfilPsicografico      JSON        NOT NULL,
    kickoffMasterlist       JSON        NOT NULL,
    auditVisual             JSON        NULL,
    estrategiaDeProtecao    JSON        NULL,
    rawPrompt               LONGTEXT    NULL,
    rawResponse             LONGTEXT    NULL,
    modelUsed               VARCHAR(100) NULL,
    generatedAt             DATETIME(6) NOT NULL,
    KEY ix_insights_submission (submissionId)
) ENGINE=InnoDB;

-- ── templates (user-created) ─────────────────────────────────────────────────
CREATE TABLE templates (
    id               CHAR(36)     NOT NULL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    description      TEXT         NULL,
    icon             VARCHAR(100) NULL,
    category         VARCHAR(100) NULL,
    tags             JSON         NULL,
    defaultGroups    JSON         NULL,
    defaultBranding  JSON         NULL,
    workspaceId      CHAR(36)     NULL,
    ownerId          VARCHAR(64)  NULL,
    createdAt        DATETIME(6)  NOT NULL,
    updatedAt        DATETIME(6)  NOT NULL,
    KEY ix_templates_workspace_created (workspaceId, createdAt),
    KEY ix_templates_owner_created (ownerId, createdAt)
) ENGINE=InnoDB;

-- ── system_templates (read-only, seeded) ────────────────────────────────────
CREATE TABLE system_templates (
    id               VARCHAR(64)  NOT NULL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    description      TEXT         NULL,
    icon             VARCHAR(100) NULL,
    category         VARCHAR(100) NULL,
    tags             JSON         NULL,
    defaultGroups    JSON         NULL,
    defaultBranding  JSON         NULL
) ENGINE=InnoDB;

-- ── folders ──────────────────────────────────────────────────────────────────
CREATE TABLE folders (
    id           CHAR(36)     NOT NULL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    workspaceId  CHAR(36)     NOT NULL,
    ownerId      VARCHAR(64)  NULL,
    createdAt    DATETIME(6)  NOT NULL,
    KEY ix_folders_workspace (workspaceId),
    CONSTRAINT fk_folders_workspace FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── workspace_invites ────────────────────────────────────────────────────────
CREATE TABLE workspace_invites (
    id           CHAR(36)     NOT NULL PRIMARY KEY,
    code         VARCHAR(32)  NOT NULL,
    workspaceId  CHAR(36)     NOT NULL,
    role         VARCHAR(20)  NOT NULL,
    createdBy    VARCHAR(64)  NOT NULL,
    invitedUid   VARCHAR(64)  NULL,
    expiresAt    DATETIME(6)  NOT NULL,
    maxUses      INT          NOT NULL DEFAULT 0,
    useCount     INT          NOT NULL DEFAULT 0,
    active       TINYINT(1)   NOT NULL DEFAULT 1,
    createdAt    DATETIME(6)  NOT NULL,
    UNIQUE KEY uq_invites_code (code),
    KEY ix_invites_workspace_active (workspaceId, active),
    KEY ix_invites_invited_active (invitedUid, active),
    CONSTRAINT fk_invites_workspace FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;
