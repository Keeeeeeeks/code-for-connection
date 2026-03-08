-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "ClearanceLevel" AS ENUM ('minimum', 'general', 'restricted', 'segregated');

-- CreateEnum
CREATE TYPE "WordTier" AS ENUM ('blacklist', 'greylist', 'watchlist');

-- CreateEnum
CREATE TYPE "WordCategory" AS ENUM ('drug', 'violence', 'gang', 'coded_threat', 'contraband', 'escape', 'other');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "FlaggedContentType" AS ENUM ('message', 'voice_call', 'video_call', 'attachment');

-- CreateEnum
CREATE TYPE "FlagReason" AS ENUM ('keyword_match', 'manual', 'pattern_alert');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('pending', 'in_review', 'dismissed', 'escalated', 'resolved');

-- AlterTable
ALTER TABLE "housing_unit_types" ADD COLUMN     "clearance_level" "ClearanceLevel" NOT NULL DEFAULT 'general',
ADD COLUMN     "content_review_required" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_daily_messages" INTEGER,
ADD COLUMN     "max_daily_voice_calls" INTEGER,
ADD COLUMN     "max_weekly_video_requests" INTEGER,
ADD COLUMN     "messaging_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "video_calls_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "voice_calls_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "keyword_alerts" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "is_regex" BOOLEAN NOT NULL DEFAULT false,
    "severity" "AlertSeverity" NOT NULL,
    "tier" "WordTier" NOT NULL DEFAULT 'greylist',
    "category" "WordCategory" NOT NULL,
    "facility_id" TEXT,
    "agency_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flagged_content" (
    "id" TEXT NOT NULL,
    "content_type" "FlaggedContentType" NOT NULL,
    "content_id" TEXT NOT NULL,
    "flag_reason" "FlagReason" NOT NULL,
    "keyword_alert_id" TEXT,
    "matched_text" TEXT,
    "severity" "AlertSeverity" NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flagged_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_usage" (
    "id" TEXT NOT NULL,
    "incarcerated_person_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "voice_call_count" INTEGER NOT NULL DEFAULT 0,
    "voice_call_minutes" INTEGER NOT NULL DEFAULT 0,
    "video_call_count" INTEGER NOT NULL DEFAULT 0,
    "messages_sent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flagged_content_content_type_content_id_idx" ON "flagged_content"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "flagged_content_status_idx" ON "flagged_content"("status");

-- CreateIndex
CREATE INDEX "flagged_content_severity_idx" ON "flagged_content"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "daily_usage_incarcerated_person_id_date_key" ON "daily_usage"("incarcerated_person_id", "date");

-- AddForeignKey
ALTER TABLE "keyword_alerts" ADD CONSTRAINT "keyword_alerts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_alerts" ADD CONSTRAINT "keyword_alerts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_alerts" ADD CONSTRAINT "keyword_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flagged_content" ADD CONSTRAINT "flagged_content_keyword_alert_id_fkey" FOREIGN KEY ("keyword_alert_id") REFERENCES "keyword_alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flagged_content" ADD CONSTRAINT "flagged_content_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flagged_content" ADD CONSTRAINT "flagged_content_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_incarcerated_person_id_fkey" FOREIGN KEY ("incarcerated_person_id") REFERENCES "incarcerated_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
