CREATE TABLE `nook_appearances` (
	`id` text PRIMARY KEY NOT NULL,
	`nook_id` text NOT NULL,
	`rig_version` text DEFAULT 'nook-rig@1' NOT NULL,
	`primary_color` text NOT NULL,
	`secondary_color` text NOT NULL,
	`face_glow` text NOT NULL,
	`outfit_id` text,
	`accessory_ids_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `nook_appearances_nook_idx` ON `nook_appearances` (`nook_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `nook_skills` (
	`nook_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`installed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`nook_id`, `skill_id`)
);
--> statement-breakpoint
CREATE TABLE `nooks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`base_species` text DEFAULT 'orbit-v1' NOT NULL,
	`working_style` text DEFAULT 'calm' NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`memory_policy` text DEFAULT 'ask' NOT NULL,
	`active_appearance_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `nooks_owner_idx` ON `nooks` (`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nooks_owner_name_idx` ON `nooks` (`owner_user_id`,`name`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`handle` text,
	`display_name` text,
	`image_url` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`onboarding_state` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_email_idx` ON `profiles` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_handle_idx` ON `profiles` (`handle`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_user_id` text NOT NULL,
	`name` text NOT NULL,
	`summary` text NOT NULL,
	`version` text NOT NULL,
	`permissions_json` text DEFAULT '[]' NOT NULL,
	`approval_policy_json` text DEFAULT '{}' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `skills_creator_idx` ON `skills` (`creator_user_id`,`review_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `skills_creator_name_version_idx` ON `skills` (`creator_user_id`,`name`,`version`);--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_events_task_idx` ON `task_events` (`task_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`nook_id` text NOT NULL,
	`input` text NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`risk_class` integer DEFAULT 0 NOT NULL,
	`plan_json` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_owner_status_idx` ON `tasks` (`owner_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `tasks_nook_idx` ON `tasks` (`nook_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wearables` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_user_id` text NOT NULL,
	`name` text NOT NULL,
	`slot` text NOT NULL,
	`supported_rig` text DEFAULT 'nook-rig@1' NOT NULL,
	`asset_key` text,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`moderation_status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wearables_creator_idx` ON `wearables` (`creator_user_id`,`moderation_status`);--> statement-breakpoint
CREATE INDEX `wearables_rig_slot_idx` ON `wearables` (`supported_rig`,`slot`);