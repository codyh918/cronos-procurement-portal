-- Allow hard deletion of Atlas users from Supabase Auth.
-- Access rows already cascade. Historical user references are retained as NULL.
-- Plain SQL only: no procedural block or dollar quoting is required.

alter table if exists public.atlas_user_profiles
  alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists atlas_user_profiles_auth_user_id_fkey,
  drop constraint if exists atlas_user_profiles_created_by_fkey,
  drop constraint if exists atlas_user_profiles_updated_by_fkey,
  add constraint atlas_user_profiles_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete cascade,
  add constraint atlas_user_profiles_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint atlas_user_profiles_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_audit_events drop constraint if exists atlas_audit_events_actor_user_id_fkey,
  add constraint atlas_audit_events_actor_user_id_fkey foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table if exists public.atlas_customers
  alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists atlas_customers_created_by_fkey, drop constraint if exists atlas_customers_updated_by_fkey, drop constraint if exists atlas_customers_deleted_by_fkey,
  add constraint atlas_customers_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint atlas_customers_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null,
  add constraint atlas_customers_deleted_by_fkey foreign key (deleted_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_customer_addresses
  alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists atlas_customer_addresses_created_by_fkey, drop constraint if exists atlas_customer_addresses_updated_by_fkey, drop constraint if exists atlas_customer_addresses_deleted_by_fkey,
  add constraint atlas_customer_addresses_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint atlas_customer_addresses_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null,
  add constraint atlas_customer_addresses_deleted_by_fkey foreign key (deleted_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_vendors
  alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists atlas_vendors_created_by_fkey, drop constraint if exists atlas_vendors_updated_by_fkey, drop constraint if exists atlas_vendors_deleted_by_fkey,
  add constraint atlas_vendors_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint atlas_vendors_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null,
  add constraint atlas_vendors_deleted_by_fkey foreign key (deleted_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_data_audit_events alter column actor_id drop not null,
  drop constraint if exists atlas_data_audit_events_actor_id_fkey,
  add constraint atlas_data_audit_events_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null;

alter table if exists public.atlas_projects alter column created_by drop not null,
  drop constraint if exists atlas_projects_created_by_fkey,
  add constraint atlas_projects_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_imports alter column imported_by drop not null,
  drop constraint if exists sewp_rfq_imports_imported_by_fkey, drop constraint if exists sewp_rfq_imports_approved_by_fkey,
  add constraint sewp_rfq_imports_imported_by_fkey foreign key (imported_by) references auth.users(id) on delete set null,
  add constraint sewp_rfq_imports_approved_by_fkey foreign key (approved_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_catalog_import_batches
  drop constraint if exists atlas_catalog_import_batches_imported_by_fkey, drop constraint if exists atlas_catalog_import_batches_pricing_verified_by_fkey,
  add constraint atlas_catalog_import_batches_imported_by_fkey foreign key (imported_by) references auth.users(id) on delete set null,
  add constraint atlas_catalog_import_batches_pricing_verified_by_fkey foreign key (pricing_verified_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_products
  drop constraint if exists atlas_products_created_by_fkey, drop constraint if exists atlas_products_updated_by_fkey,
  add constraint atlas_products_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint atlas_products_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_product_pricing_history
  drop constraint if exists atlas_product_pricing_history_imported_by_fkey, drop constraint if exists atlas_product_pricing_history_verified_by_fkey,
  add constraint atlas_product_pricing_history_imported_by_fkey foreign key (imported_by) references auth.users(id) on delete set null,
  add constraint atlas_product_pricing_history_verified_by_fkey foreign key (verified_by) references auth.users(id) on delete set null;

alter table if exists public.atlas_catalog_audit_events drop constraint if exists atlas_catalog_audit_events_actor_user_id_fkey,
  add constraint atlas_catalog_audit_events_actor_user_id_fkey foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table if exists public.atlas_quote_pricing_audit alter column applied_by drop not null,
  drop constraint if exists atlas_quote_pricing_audit_applied_by_fkey,
  add constraint atlas_quote_pricing_audit_applied_by_fkey foreign key (applied_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_user_permissions drop constraint if exists sewp_user_permissions_granted_by_fkey,
  add constraint sewp_user_permissions_granted_by_fkey foreign key (granted_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfqs
  alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists sewp_rfqs_owner_user_id_fkey, drop constraint if exists sewp_rfqs_backup_owner_user_id_fkey,
  drop constraint if exists sewp_rfqs_next_action_owner_user_id_fkey, drop constraint if exists sewp_rfqs_created_by_fkey, drop constraint if exists sewp_rfqs_updated_by_fkey,
  add constraint sewp_rfqs_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id) on delete set null,
  add constraint sewp_rfqs_backup_owner_user_id_fkey foreign key (backup_owner_user_id) references auth.users(id) on delete set null,
  add constraint sewp_rfqs_next_action_owner_user_id_fkey foreign key (next_action_owner_user_id) references auth.users(id) on delete set null,
  add constraint sewp_rfqs_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint sewp_rfqs_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_contacts alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists sewp_rfq_contacts_created_by_fkey, drop constraint if exists sewp_rfq_contacts_updated_by_fkey,
  add constraint sewp_rfq_contacts_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint sewp_rfq_contacts_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_documents alter column uploaded_by drop not null,
  drop constraint if exists sewp_rfq_documents_uploaded_by_fkey,
  add constraint sewp_rfq_documents_uploaded_by_fkey foreign key (uploaded_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_amendments alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists sewp_rfq_amendments_created_by_fkey, drop constraint if exists sewp_rfq_amendments_updated_by_fkey,
  add constraint sewp_rfq_amendments_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint sewp_rfq_amendments_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_assignments alter column assigned_user_id drop not null, alter column assigned_by drop not null,
  drop constraint if exists sewp_rfq_assignments_assigned_user_id_fkey, drop constraint if exists sewp_rfq_assignments_assigned_by_fkey,
  add constraint sewp_rfq_assignments_assigned_user_id_fkey foreign key (assigned_user_id) references auth.users(id) on delete set null,
  add constraint sewp_rfq_assignments_assigned_by_fkey foreign key (assigned_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_tasks alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists sewp_rfq_tasks_assigned_user_id_fkey, drop constraint if exists sewp_rfq_tasks_created_by_fkey, drop constraint if exists sewp_rfq_tasks_updated_by_fkey,
  add constraint sewp_rfq_tasks_assigned_user_id_fkey foreign key (assigned_user_id) references auth.users(id) on delete set null,
  add constraint sewp_rfq_tasks_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint sewp_rfq_tasks_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_stage_history alter column actor_user_id drop not null,
  drop constraint if exists sewp_rfq_stage_history_actor_user_id_fkey,
  add constraint sewp_rfq_stage_history_actor_user_id_fkey foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_audit_events drop constraint if exists sewp_rfq_audit_events_actor_user_id_fkey,
  add constraint sewp_rfq_audit_events_actor_user_id_fkey foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_extraction_runs alter column created_by drop not null,
  drop constraint if exists sewp_rfq_extraction_runs_created_by_fkey,
  add constraint sewp_rfq_extraction_runs_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_extracted_fields drop constraint if exists sewp_rfq_extracted_fields_verified_by_fkey,
  add constraint sewp_rfq_extracted_fields_verified_by_fkey foreign key (verified_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_requirements alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists sewp_rfq_requirements_reviewer_user_id_fkey, drop constraint if exists sewp_rfq_requirements_created_by_fkey, drop constraint if exists sewp_rfq_requirements_updated_by_fkey,
  add constraint sewp_rfq_requirements_reviewer_user_id_fkey foreign key (reviewer_user_id) references auth.users(id) on delete set null,
  add constraint sewp_rfq_requirements_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint sewp_rfq_requirements_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_line_items alter column created_by drop not null, alter column updated_by drop not null,
  drop constraint if exists sewp_rfq_line_items_created_by_fkey, drop constraint if exists sewp_rfq_line_items_updated_by_fkey,
  add constraint sewp_rfq_line_items_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null,
  add constraint sewp_rfq_line_items_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_field_corrections alter column corrected_by drop not null,
  drop constraint if exists sewp_rfq_field_corrections_corrected_by_fkey,
  add constraint sewp_rfq_field_corrections_corrected_by_fkey foreign key (corrected_by) references auth.users(id) on delete set null;

alter table if exists public.sewp_rfq_ai_summaries drop constraint if exists sewp_rfq_ai_summaries_reviewed_by_fkey,
  add constraint sewp_rfq_ai_summaries_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table if exists public.procurement_notes drop constraint if exists procurement_notes_created_by_fkey,
  add constraint procurement_notes_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table if exists public.procurement_actions
  drop constraint if exists procurement_actions_owner_id_fkey, drop constraint if exists procurement_actions_assigned_by_fkey,
  add constraint procurement_actions_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null,
  add constraint procurement_actions_assigned_by_fkey foreign key (assigned_by) references auth.users(id) on delete set null;

alter table if exists public.procurement_discussion_flags
  drop constraint if exists procurement_discussion_flags_flagged_by_fkey, drop constraint if exists procurement_discussion_flags_resolved_by_fkey,
  add constraint procurement_discussion_flags_flagged_by_fkey foreign key (flagged_by) references auth.users(id) on delete set null,
  add constraint procurement_discussion_flags_resolved_by_fkey foreign key (resolved_by) references auth.users(id) on delete set null;

alter table if exists public.procurement_overrides drop constraint if exists procurement_overrides_updated_by_fkey,
  add constraint procurement_overrides_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table if exists public.procurement_activity drop constraint if exists procurement_activity_actor_id_fkey,
  add constraint procurement_activity_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null;

alter table if exists public.weekly_procurement_meetings drop constraint if exists weekly_procurement_meetings_started_by_fkey,
  add constraint weekly_procurement_meetings_started_by_fkey foreign key (started_by) references auth.users(id) on delete set null;
