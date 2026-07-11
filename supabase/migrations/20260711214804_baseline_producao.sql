


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."distance_category" AS ENUM (
    '1km',
    '5km',
    '10km',
    '21km',
    '42km'
);


ALTER TYPE "public"."distance_category" OWNER TO "postgres";


CREATE TYPE "public"."training_type" AS ENUM (
    'corrida',
    'hiit',
    'recovery',
    'forca',
    'mobilidade'
);


ALTER TYPE "public"."training_type" OWNER TO "postgres";


CREATE TYPE "public"."user_level" AS ENUM (
    'iniciante',
    'intermediario',
    'avancado'
);


ALTER TYPE "public"."user_level" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
$$;


ALTER FUNCTION "private"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_email"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  user_email text;
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  RETURN user_email;
END;
$$;


ALTER FUNCTION "public"."get_user_email"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.role := COALESCE(
    NULLIF((
      SELECT raw_user_meta_data->>'role'
      FROM auth.users
      WHERE id = NEW.id
    ), ''),
    'aluno'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_profile_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    NEW.raw_app_meta_data :=
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role', NEW.raw_user_meta_data->>'role');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_plans_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_group_plans_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."anamnesis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "weight_kg" numeric(5,2),
    "height_cm" integer,
    "max_heart_rate" integer,
    "weekly_frequency" integer,
    "objectives" "text"[],
    "physical_limitations" "text",
    "experience_years" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."anamnesis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "training_id" "uuid",
    "plan_id" "uuid",
    "actual_distance_m" integer,
    "actual_duration_seconds" integer,
    "actual_pace_seconds_per_km" integer,
    "notes" "text",
    "strava_activity_id" bigint,
    "approved" boolean DEFAULT false,
    "approved_by" "uuid",
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "perceived_effort" smallint,
    CONSTRAINT "checkins_perceived_effort_check" CHECK ((("perceived_effort" >= 1) AND ("perceived_effort" <= 5)))
);


ALTER TABLE "public"."checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_plan_trainings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_plan_id" "uuid" NOT NULL,
    "week_number" smallint NOT NULL,
    "day_of_week" smallint,
    "training_id" "uuid" NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    CONSTRAINT "group_plan_trainings_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 6))),
    CONSTRAINT "group_plan_trainings_week_number_check" CHECK ((("week_number" >= 1) AND ("week_number" <= 4)))
);


ALTER TABLE "public"."group_plan_trainings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "starts_at" "date" NOT NULL,
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "released_through_week" smallint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."group_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "goal" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "plan_type" "text" DEFAULT 'grupo'::"text" NOT NULL,
    "starts_at" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mode" "text" DEFAULT 'fixo'::"text" NOT NULL,
    CONSTRAINT "groups_frequency_check" CHECK (("frequency" = ANY (ARRAY['2x'::"text", '3x'::"text"]))),
    CONSTRAINT "groups_goal_check" CHECK (("goal" = ANY (ARRAY['5k'::"text", '10k'::"text", '21k'::"text", 'evoluir_10k'::"text", 'evoluir_21k'::"text"]))),
    CONSTRAINT "groups_mode_check" CHECK (("mode" = ANY (ARRAY['fixo'::"text", 'flexivel'::"text"]))),
    CONSTRAINT "groups_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['grupo'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "invites_role_check" CHECK (("role" = ANY (ARRAY['aluno'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "admin_id" "uuid",
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "deleted_by_student" boolean DEFAULT false NOT NULL,
    "deleted_by_admin" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "birth_date" "date",
    "level" "public"."user_level" DEFAULT 'iniciante'::"public"."user_level",
    "strava_athlete_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "has_set_password" boolean DEFAULT false NOT NULL,
    "role" "text",
    "group_id" "uuid",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['aluno'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reaction_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "distance_category" "public"."distance_category" NOT NULL,
    "time_seconds" integer NOT NULL,
    "achieved_at" "date" NOT NULL,
    "checkin_id" "uuid",
    "strava_activity_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "group_plan_training_id" "uuid" NOT NULL,
    "scheduled_day_of_week" smallint NOT NULL,
    "completed_at" timestamp with time zone,
    "checkin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "schedules_scheduled_day_of_week_check" CHECK ((("scheduled_day_of_week" >= 1) AND ("scheduled_day_of_week" <= 6)))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strava_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "strava_id" bigint,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "distance_m" integer NOT NULL,
    "duration_seconds" integer NOT NULL,
    "pace_seconds_per_km" integer,
    "start_date" timestamp with time zone NOT NULL,
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."strava_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strava_analysis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "activity_id" bigint NOT NULL,
    "activity_name" "text" NOT NULL,
    "distance_m" integer NOT NULL,
    "moving_time_seconds" integer NOT NULL,
    "average_speed" double precision NOT NULL,
    "summary" "text" NOT NULL,
    "analysis" "text" NOT NULL,
    "tip" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."strava_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strava_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "strava_athlete_id" bigint NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "scope" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."strava_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#E8521A'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT 'orange'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "training_programs_color_check" CHECK (("color" = ANY (ARRAY['orange'::"text", 'green'::"text", 'yellow'::"text", 'red'::"text"])))
);


ALTER TABLE "public"."training_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_custom" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trainings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" NOT NULL,
    "distance_m" integer,
    "target_pace_seconds_per_km" integer,
    "sets" integer DEFAULT 1,
    "duration_minutes" integer,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tag_id" "uuid",
    "video_url" "text",
    "category" "text",
    "program" "text"
);


ALTER TABLE "public"."trainings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_plan_trainings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "training_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."weekly_plan_trainings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_plans" OWNER TO "postgres";


ALTER TABLE ONLY "public"."anamnesis"
    ADD CONSTRAINT "anamnesis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anamnesis"
    ADD CONSTRAINT "anamnesis_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_plan_trainings"
    ADD CONSTRAINT "group_plan_trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_group_id_starts_at_key" UNIQUE ("group_id", "starts_at");



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_user_id_target_type_target_id_reaction_type_key" UNIQUE ("user_id", "target_type", "target_id", "reaction_type");



ALTER TABLE ONLY "public"."records"
    ADD CONSTRAINT "records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_student_id_group_plan_training_id_key" UNIQUE ("student_id", "group_plan_training_id");



ALTER TABLE ONLY "public"."strava_activities"
    ADD CONSTRAINT "strava_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strava_activities"
    ADD CONSTRAINT "strava_activities_strava_id_key" UNIQUE ("strava_id");



ALTER TABLE ONLY "public"."strava_analysis"
    ADD CONSTRAINT "strava_analysis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strava_analysis"
    ADD CONSTRAINT "strava_analysis_student_id_activity_id_key" UNIQUE ("student_id", "activity_id");



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_name_created_by_key" UNIQUE ("name", "created_by");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_programs"
    ADD CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_programs"
    ADD CONSTRAINT "training_programs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."training_types"
    ADD CONSTRAINT "training_types_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."training_types"
    ADD CONSTRAINT "training_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_plan_trainings"
    ADD CONSTRAINT "weekly_plan_trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_plans"
    ADD CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_plans"
    ADD CONSTRAINT "weekly_plans_student_id_week_start_key" UNIQUE ("student_id", "week_start");



CREATE INDEX "idx_checkins_student_date" ON "public"."checkins" USING "btree" ("student_id", "completed_at" DESC);



CREATE INDEX "idx_checkins_student_id" ON "public"."checkins" USING "btree" ("student_id");



CREATE INDEX "idx_checkins_student_training" ON "public"."checkins" USING "btree" ("student_id", "training_id");



CREATE INDEX "idx_comments_target" ON "public"."comments" USING "btree" ("target_type", "target_id", "created_at" DESC);



CREATE INDEX "idx_gpt_plan_id" ON "public"."group_plan_trainings" USING "btree" ("group_plan_id");



CREATE INDEX "idx_group_plans_group_cycle" ON "public"."group_plans" USING "btree" ("group_id", "starts_at");



CREATE INDEX "idx_messages_student_id" ON "public"."messages" USING "btree" ("student_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_reactions_target" ON "public"."reactions" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_records_achieved_at" ON "public"."records" USING "btree" ("achieved_at" DESC);



CREATE INDEX "idx_records_student_category" ON "public"."records" USING "btree" ("student_id", "distance_category", "time_seconds");



CREATE INDEX "idx_records_student_id" ON "public"."records" USING "btree" ("student_id");



CREATE INDEX "idx_schedules_gpt_id" ON "public"."schedules" USING "btree" ("group_plan_training_id");



CREATE INDEX "idx_schedules_student_id" ON "public"."schedules" USING "btree" ("student_id");



CREATE INDEX "idx_strava_activities_user_date" ON "public"."strava_activities" USING "btree" ("user_id", "start_date" DESC);



CREATE INDEX "idx_strava_analysis_student_id" ON "public"."strava_analysis" USING "btree" ("student_id", "created_at" DESC);



CREATE INDEX "idx_training_programs_slug" ON "public"."training_programs" USING "btree" ("slug");



CREATE INDEX "idx_trainings_category" ON "public"."trainings" USING "btree" ("category");



CREATE INDEX "idx_trainings_program" ON "public"."trainings" USING "btree" ("program");



CREATE OR REPLACE TRIGGER "set_schedules_updated_at" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_training_programs_updated_at" BEFORE UPDATE ON "public"."training_programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tr_set_profile_role" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profile_role"();



CREATE OR REPLACE TRIGGER "trg_group_plans_updated_at" BEFORE UPDATE ON "public"."group_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_group_plans_updated_at"();



CREATE OR REPLACE TRIGGER "update_anamnesis_updated_at" BEFORE UPDATE ON "public"."anamnesis" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_groups_updated_at" BEFORE UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_strava_connections_updated_at" BEFORE UPDATE ON "public"."strava_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tags_updated_at" BEFORE UPDATE ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trainings_updated_at" BEFORE UPDATE ON "public"."trainings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."anamnesis"
    ADD CONSTRAINT "anamnesis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_plans"("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."group_plan_trainings"
    ADD CONSTRAINT "group_plan_trainings_group_plan_id_fkey" FOREIGN KEY ("group_plan_id") REFERENCES "public"."group_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_plan_trainings"
    ADD CONSTRAINT "group_plan_trainings_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."records"
    ADD CONSTRAINT "records_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id");



ALTER TABLE ONLY "public"."records"
    ADD CONSTRAINT "records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_group_plan_training_id_fkey" FOREIGN KEY ("group_plan_training_id") REFERENCES "public"."group_plan_trainings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strava_activities"
    ADD CONSTRAINT "strava_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."strava_analysis"
    ADD CONSTRAINT "strava_analysis_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."training_programs"
    ADD CONSTRAINT "training_programs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_types"
    ADD CONSTRAINT "training_types_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weekly_plan_trainings"
    ADD CONSTRAINT "weekly_plan_trainings_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_plan_trainings"
    ADD CONSTRAINT "weekly_plan_trainings_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id");



ALTER TABLE ONLY "public"."weekly_plans"
    ADD CONSTRAINT "weekly_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."weekly_plans"
    ADD CONSTRAINT "weekly_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admin full access training_types" ON "public"."training_types" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admin lê schedules" ON "public"."schedules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admin pode atualizar mensagens" ON "public"."messages" FOR UPDATE USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admin pode enviar mensagens" ON "public"."messages" FOR INSERT WITH CHECK ((((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") AND ("auth"."uid"() = "sender_id")));



CREATE POLICY "Admin pode tudo" ON "public"."tags" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "Admin pode ver todas as mensagens" ON "public"."messages" FOR SELECT USING ((((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") AND ("deleted_by_admin" = false)));



CREATE POLICY "Admins gerenciam programas" ON "public"."training_programs" TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins podem atualizar convites" ON "public"."invites" FOR UPDATE USING ("private"."is_admin"());



CREATE POLICY "Admins podem deletar convites" ON "public"."invites" FOR DELETE USING ("private"."is_admin"());



CREATE POLICY "Admins podem inserir convites" ON "public"."invites" FOR INSERT WITH CHECK ("private"."is_admin"());



CREATE POLICY "Admins podem ver convites" ON "public"."invites" FOR SELECT USING ("private"."is_admin"());



CREATE POLICY "Admins têm acesso total às mensagens" ON "public"."messages" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Aluno CRUD próprio schedule" ON "public"."schedules" TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Aluno pode atualizar suas mensagens" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Aluno pode enviar mensagens" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "student_id") AND ("auth"."uid"() = "sender_id")));



CREATE POLICY "Aluno pode ler" ON "public"."tags" FOR SELECT USING (true);



CREATE POLICY "Aluno pode ver suas mensagens" ON "public"."messages" FOR SELECT USING ((("auth"."uid"() = "student_id") AND ("deleted_by_student" = false)));



CREATE POLICY "Alunos podem atualizar as próprias mensagens (exclusão lógic" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Alunos podem enviar mensagens" ON "public"."messages" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Alunos podem visualizar as próprias mensagens" ON "public"."messages" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Alunos select training_types" ON "public"."training_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Todos autenticados leem programas" ON "public"."training_programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "admin_all_group_plan_trainings" ON "public"."group_plan_trainings" TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



CREATE POLICY "admin_all_group_plans" ON "public"."group_plans" TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



CREATE POLICY "admin_all_groups" ON "public"."groups" TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "aluno_select_group_plan_trainings" ON "public"."group_plan_trainings" FOR SELECT TO "authenticated" USING (("group_plan_id" IN ( SELECT "group_plans"."id"
   FROM "public"."group_plans"
  WHERE ("group_plans"."group_id" = ( SELECT "profiles"."group_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "aluno_select_group_plans" ON "public"."group_plans" FOR SELECT TO "authenticated" USING (("group_id" = ( SELECT "profiles"."group_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "aluno_select_groups" ON "public"."groups" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."anamnesis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anamnesis_delete" ON "public"."anamnesis" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "anamnesis_insert" ON "public"."anamnesis" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "anamnesis_select" ON "public"."anamnesis" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



CREATE POLICY "anamnesis_update" ON "public"."anamnesis" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checkins_delete" ON "public"."checkins" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "checkins_insert" ON "public"."checkins" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "checkins_select" ON "public"."checkins" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



CREATE POLICY "checkins_update" ON "public"."checkins" FOR UPDATE TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin"))) WITH CHECK ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete" ON "public"."comments" FOR DELETE TO "authenticated" USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



CREATE POLICY "comments_insert" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "comments_select" ON "public"."comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "comments_update" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."group_plan_trainings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



ALTER TABLE "public"."reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reactions_delete" ON "public"."reactions" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reactions_insert" ON "public"."reactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reactions_select" ON "public"."reactions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "records_delete" ON "public"."records" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "records_insert" ON "public"."records" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "records_select" ON "public"."records" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "records_update" ON "public"."records" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."strava_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "strava_activities_delete" ON "public"."strava_activities" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "strava_activities_select" ON "public"."strava_activities" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



ALTER TABLE "public"."strava_analysis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "strava_analysis_select" ON "public"."strava_analysis" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



ALTER TABLE "public"."strava_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trainings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trainings_delete" ON "public"."trainings" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "trainings_insert" ON "public"."trainings" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "trainings_select" ON "public"."trainings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "trainings_update" ON "public"."trainings" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."weekly_plan_trainings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_plan_trainings_delete" ON "public"."weekly_plan_trainings" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "weekly_plan_trainings_insert" ON "public"."weekly_plan_trainings" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "weekly_plan_trainings_select" ON "public"."weekly_plan_trainings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."weekly_plans" "wp"
  WHERE (("wp"."id" = "weekly_plan_trainings"."plan_id") AND (("wp"."student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin"))))));



CREATE POLICY "weekly_plan_trainings_update" ON "public"."weekly_plan_trainings" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."weekly_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_plans_delete" ON "public"."weekly_plans" FOR DELETE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "weekly_plans_insert" ON "public"."weekly_plans" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "weekly_plans_select" ON "public"."weekly_plans" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_admin"() AS "is_admin")));



CREATE POLICY "weekly_plans_update" ON "public"."weekly_plans" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."get_user_email"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_email"("user_id" "uuid") TO "authenticated";


















GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."anamnesis" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."anamnesis" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."anamnesis" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."checkins" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."checkins" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."checkins" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_plan_trainings" TO "anon";
GRANT ALL ON TABLE "public"."group_plan_trainings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_plan_trainings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_plans" TO "anon";
GRANT ALL ON TABLE "public"."group_plans" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_plans" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."groups" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."invites" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."messages" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reactions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reactions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."records" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."records" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."schedules" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."strava_activities" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."strava_activities" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."strava_activities" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."strava_analysis" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."strava_analysis" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."strava_analysis" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."strava_connections" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."strava_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."strava_connections" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tags" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_programs" TO "anon";
GRANT ALL ON TABLE "public"."training_programs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_programs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_types" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."training_types" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."trainings" TO "anon";
GRANT ALL ON TABLE "public"."trainings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."trainings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."weekly_plan_trainings" TO "anon";
GRANT ALL ON TABLE "public"."weekly_plan_trainings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."weekly_plan_trainings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."weekly_plans" TO "anon";
GRANT ALL ON TABLE "public"."weekly_plans" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."weekly_plans" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";



































drop extension if exists "pg_net";

revoke delete on table "public"."anamnesis" from "anon";

revoke insert on table "public"."anamnesis" from "anon";

revoke select on table "public"."anamnesis" from "anon";

revoke update on table "public"."anamnesis" from "anon";

revoke delete on table "public"."anamnesis" from "authenticated";

revoke delete on table "public"."anamnesis" from "service_role";

revoke insert on table "public"."anamnesis" from "service_role";

revoke select on table "public"."anamnesis" from "service_role";

revoke update on table "public"."anamnesis" from "service_role";

revoke delete on table "public"."checkins" from "anon";

revoke insert on table "public"."checkins" from "anon";

revoke select on table "public"."checkins" from "anon";

revoke update on table "public"."checkins" from "anon";

revoke delete on table "public"."checkins" from "authenticated";

revoke delete on table "public"."checkins" from "service_role";

revoke insert on table "public"."checkins" from "service_role";

revoke select on table "public"."checkins" from "service_role";

revoke update on table "public"."checkins" from "service_role";

revoke delete on table "public"."comments" from "anon";

revoke insert on table "public"."comments" from "anon";

revoke select on table "public"."comments" from "anon";

revoke update on table "public"."comments" from "anon";

revoke delete on table "public"."comments" from "service_role";

revoke insert on table "public"."comments" from "service_role";

revoke select on table "public"."comments" from "service_role";

revoke update on table "public"."comments" from "service_role";

revoke delete on table "public"."group_plan_trainings" from "anon";

revoke insert on table "public"."group_plan_trainings" from "anon";

revoke select on table "public"."group_plan_trainings" from "anon";

revoke update on table "public"."group_plan_trainings" from "anon";

revoke delete on table "public"."group_plan_trainings" from "service_role";

revoke insert on table "public"."group_plan_trainings" from "service_role";

revoke select on table "public"."group_plan_trainings" from "service_role";

revoke update on table "public"."group_plan_trainings" from "service_role";

revoke delete on table "public"."group_plans" from "anon";

revoke insert on table "public"."group_plans" from "anon";

revoke select on table "public"."group_plans" from "anon";

revoke update on table "public"."group_plans" from "anon";

revoke delete on table "public"."group_plans" from "service_role";

revoke insert on table "public"."group_plans" from "service_role";

revoke select on table "public"."group_plans" from "service_role";

revoke update on table "public"."group_plans" from "service_role";

revoke delete on table "public"."groups" from "anon";

revoke insert on table "public"."groups" from "anon";

revoke select on table "public"."groups" from "anon";

revoke update on table "public"."groups" from "anon";

revoke delete on table "public"."groups" from "service_role";

revoke insert on table "public"."groups" from "service_role";

revoke select on table "public"."groups" from "service_role";

revoke update on table "public"."groups" from "service_role";

revoke delete on table "public"."invites" from "anon";

revoke insert on table "public"."invites" from "anon";

revoke select on table "public"."invites" from "anon";

revoke update on table "public"."invites" from "anon";

revoke delete on table "public"."invites" from "service_role";

revoke insert on table "public"."invites" from "service_role";

revoke select on table "public"."invites" from "service_role";

revoke update on table "public"."invites" from "service_role";

revoke delete on table "public"."messages" from "anon";

revoke insert on table "public"."messages" from "anon";

revoke select on table "public"."messages" from "anon";

revoke update on table "public"."messages" from "anon";

revoke delete on table "public"."messages" from "service_role";

revoke insert on table "public"."messages" from "service_role";

revoke select on table "public"."messages" from "service_role";

revoke update on table "public"."messages" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."reactions" from "anon";

revoke insert on table "public"."reactions" from "anon";

revoke select on table "public"."reactions" from "anon";

revoke update on table "public"."reactions" from "anon";

revoke update on table "public"."reactions" from "authenticated";

revoke delete on table "public"."reactions" from "service_role";

revoke insert on table "public"."reactions" from "service_role";

revoke select on table "public"."reactions" from "service_role";

revoke update on table "public"."reactions" from "service_role";

revoke delete on table "public"."records" from "anon";

revoke insert on table "public"."records" from "anon";

revoke select on table "public"."records" from "anon";

revoke update on table "public"."records" from "anon";

revoke delete on table "public"."records" from "authenticated";

revoke delete on table "public"."records" from "service_role";

revoke insert on table "public"."records" from "service_role";

revoke select on table "public"."records" from "service_role";

revoke update on table "public"."records" from "service_role";

revoke delete on table "public"."schedules" from "anon";

revoke insert on table "public"."schedules" from "anon";

revoke select on table "public"."schedules" from "anon";

revoke update on table "public"."schedules" from "anon";

revoke delete on table "public"."schedules" from "service_role";

revoke insert on table "public"."schedules" from "service_role";

revoke select on table "public"."schedules" from "service_role";

revoke update on table "public"."schedules" from "service_role";

revoke delete on table "public"."strava_activities" from "anon";

revoke insert on table "public"."strava_activities" from "anon";

revoke select on table "public"."strava_activities" from "anon";

revoke update on table "public"."strava_activities" from "anon";

revoke delete on table "public"."strava_activities" from "authenticated";

revoke insert on table "public"."strava_activities" from "authenticated";

revoke update on table "public"."strava_activities" from "authenticated";

revoke delete on table "public"."strava_activities" from "service_role";

revoke insert on table "public"."strava_activities" from "service_role";

revoke select on table "public"."strava_activities" from "service_role";

revoke update on table "public"."strava_activities" from "service_role";

revoke delete on table "public"."strava_analysis" from "anon";

revoke insert on table "public"."strava_analysis" from "anon";

revoke select on table "public"."strava_analysis" from "anon";

revoke update on table "public"."strava_analysis" from "anon";

revoke delete on table "public"."strava_analysis" from "authenticated";

revoke insert on table "public"."strava_analysis" from "authenticated";

revoke update on table "public"."strava_analysis" from "authenticated";

revoke delete on table "public"."strava_analysis" from "service_role";

revoke delete on table "public"."strava_connections" from "anon";

revoke insert on table "public"."strava_connections" from "anon";

revoke select on table "public"."strava_connections" from "anon";

revoke update on table "public"."strava_connections" from "anon";

revoke delete on table "public"."strava_connections" from "authenticated";

revoke insert on table "public"."strava_connections" from "authenticated";

revoke select on table "public"."strava_connections" from "authenticated";

revoke update on table "public"."strava_connections" from "authenticated";

revoke delete on table "public"."tags" from "anon";

revoke insert on table "public"."tags" from "anon";

revoke select on table "public"."tags" from "anon";

revoke update on table "public"."tags" from "anon";

revoke delete on table "public"."tags" from "service_role";

revoke insert on table "public"."tags" from "service_role";

revoke select on table "public"."tags" from "service_role";

revoke update on table "public"."tags" from "service_role";

revoke delete on table "public"."training_programs" from "anon";

revoke insert on table "public"."training_programs" from "anon";

revoke select on table "public"."training_programs" from "anon";

revoke update on table "public"."training_programs" from "anon";

revoke delete on table "public"."training_programs" from "service_role";

revoke insert on table "public"."training_programs" from "service_role";

revoke select on table "public"."training_programs" from "service_role";

revoke update on table "public"."training_programs" from "service_role";

revoke delete on table "public"."training_types" from "anon";

revoke insert on table "public"."training_types" from "anon";

revoke select on table "public"."training_types" from "anon";

revoke update on table "public"."training_types" from "anon";

revoke update on table "public"."training_types" from "authenticated";

revoke delete on table "public"."training_types" from "service_role";

revoke insert on table "public"."training_types" from "service_role";

revoke select on table "public"."training_types" from "service_role";

revoke update on table "public"."training_types" from "service_role";

revoke delete on table "public"."trainings" from "anon";

revoke insert on table "public"."trainings" from "anon";

revoke select on table "public"."trainings" from "anon";

revoke update on table "public"."trainings" from "anon";

revoke delete on table "public"."trainings" from "service_role";

revoke insert on table "public"."trainings" from "service_role";

revoke select on table "public"."trainings" from "service_role";

revoke update on table "public"."trainings" from "service_role";

revoke delete on table "public"."weekly_plan_trainings" from "anon";

revoke insert on table "public"."weekly_plan_trainings" from "anon";

revoke select on table "public"."weekly_plan_trainings" from "anon";

revoke update on table "public"."weekly_plan_trainings" from "anon";

revoke delete on table "public"."weekly_plan_trainings" from "service_role";

revoke insert on table "public"."weekly_plan_trainings" from "service_role";

revoke select on table "public"."weekly_plan_trainings" from "service_role";

revoke update on table "public"."weekly_plan_trainings" from "service_role";

revoke delete on table "public"."weekly_plans" from "anon";

revoke insert on table "public"."weekly_plans" from "anon";

revoke select on table "public"."weekly_plans" from "anon";

revoke update on table "public"."weekly_plans" from "anon";

revoke delete on table "public"."weekly_plans" from "service_role";

revoke insert on table "public"."weekly_plans" from "service_role";

revoke select on table "public"."weekly_plans" from "service_role";

revoke update on table "public"."weekly_plans" from "service_role";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_role_set BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.set_user_role();


