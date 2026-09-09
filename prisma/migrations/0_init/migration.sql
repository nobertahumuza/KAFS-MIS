-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Teller',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_code" TEXT NOT NULL,
    "farmer_name" TEXT NOT NULL,
    "gender" TEXT DEFAULT 'Male',
    "phone_number" TEXT,
    "email" TEXT,
    "village" TEXT,
    "parish" TEXT,
    "district" TEXT,
    "sub_county" TEXT,
    "occupation" TEXT,
    "next_of_kin_name" TEXT,
    "next_of_kin_phone" TEXT,
    "id_document_type" TEXT,
    "id_document_number" TEXT,
    "address" TEXT,
    "nin_number" TEXT,
    "main_produce" TEXT DEFAULT 'Coffee',
    "total_shares" INTEGER DEFAULT 0,
    "share_value" REAL DEFAULT 0,
    "registration_date" DATETIME NOT NULL,
    "status" TEXT DEFAULT 'Active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "account_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_name" TEXT NOT NULL,
    "requires_other_text" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Active'
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_trail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action_type" TEXT NOT NULL,
    "table_name" TEXT,
    "record_id" INTEGER,
    "description" TEXT,
    "amount" REAL,
    "member_id" INTEGER,
    "account_number" TEXT,
    "reference_number" TEXT,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_trail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "audit_trail_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER,
    "account_no" TEXT NOT NULL,
    "application_type" TEXT NOT NULL DEFAULT 'Single',
    "account_type" TEXT NOT NULL DEFAULT 'Savings Account',
    "account_type_other" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "currency_other" TEXT,
    "full_name" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'Male',
    "marital_status" TEXT DEFAULT 'Single',
    "date_of_birth" DATETIME,
    "place_of_birth" TEXT,
    "district" TEXT,
    "county" TEXT,
    "sub_county" TEXT,
    "nationality" TEXT DEFAULT 'Ugandan',
    "phone_number" TEXT,
    "email_address" TEXT,
    "residential_address" TEXT,
    "occupation" TEXT,
    "employer_business" TEXT,
    "nin_number" TEXT,
    "source_of_funds" TEXT,
    "purpose_of_account" TEXT,
    "next_of_kin_name" TEXT,
    "beneficiary" TEXT,
    "next_of_kin_contact" TEXT,
    "id_document_type" TEXT,
    "id_document_number" TEXT,
    "passport_photo" TEXT,
    "signature_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "expense_date" DATETIME NOT NULL,
    "payment_method" TEXT DEFAULT 'Cash',
    "reference_no" TEXT,
    "recorded_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fixed_accounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fixed_code" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "account_number" TEXT NOT NULL,
    "principal_amount" REAL NOT NULL,
    "start_date" DATETIME NOT NULL,
    "fixed_period" INTEGER NOT NULL,
    "maturity_date" DATETIME NOT NULL,
    "interest_rate" REAL NOT NULL,
    "interest_earned" REAL NOT NULL DEFAULT 0,
    "maturity_amount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "reference_number" TEXT,
    "created_by" INTEGER,
    "withdrawn_by" INTEGER,
    "withdrawn_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fixed_accounts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entry_code" TEXT NOT NULL,
    "entry_date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "reference_number" TEXT,
    "total_debit" REAL NOT NULL,
    "total_credit" REAL NOT NULL,
    "status" TEXT DEFAULT 'Posted',
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entry_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "member_id" INTEGER,
    "narration" TEXT,
    CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loans" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loan_code" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "principal_amount" REAL NOT NULL,
    "interest_rate" REAL NOT NULL DEFAULT 10,
    "current_balance" REAL NOT NULL,
    "loan_purpose" TEXT,
    "loan_status" TEXT DEFAULT 'Active',
    "disbursement_date" DATETIME NOT NULL,
    "due_date" DATETIME,
    "recorded_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loans_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_code" TEXT NOT NULL,
    "member_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "loan_amount" REAL NOT NULL,
    "loan_amount_words" TEXT,
    "loan_purpose" TEXT,
    "loan_duration" INTEGER,
    "loan_period_months" INTEGER,
    "repayment_mode" TEXT DEFAULT 'Monthly',
    "interest_rate" REAL DEFAULT 10,
    "monthly_installment" REAL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "submitted_at" DATETIME,
    "disbursed_at" DATETIME,
    "disbursement_date" DATETIME,
    "due_date" DATETIME,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" INTEGER,
    "modified_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_applications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_applications_modified_by_fkey" FOREIGN KEY ("modified_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_agreements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "loan_id" INTEGER,
    "borrower_name" TEXT,
    "principal_amount" REAL NOT NULL DEFAULT 0,
    "amount_words" TEXT,
    "loan_period" TEXT,
    "interest_rate" REAL NOT NULL DEFAULT 0,
    "monthly_installment" REAL NOT NULL DEFAULT 0,
    "penalty_rate" REAL NOT NULL DEFAULT 0,
    "security_pledged" TEXT,
    "guarantors_text" TEXT,
    "borrower_signature" TEXT,
    "spouse_signature" TEXT,
    "witness_signature" TEXT,
    "official_signature" TEXT,
    "agreement_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_agreements_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_agreements_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_appraisals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "appraisal_notes" TEXT,
    "recommendation" TEXT,
    "comments" TEXT,
    "officer_name" TEXT,
    "officer_id" INTEGER,
    "signature_path" TEXT,
    "appraisal_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_appraisals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_appraisals_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_audit_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "performed_by" INTEGER,
    "details" TEXT,
    "performed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_audit_log_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_audit_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_board_decisions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "decision" TEXT,
    "approved_amount" REAL NOT NULL DEFAULT 0,
    "chairperson_name" TEXT,
    "chairperson_id" INTEGER,
    "signature_path" TEXT,
    "decision_date" DATETIME,
    "comments" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_board_decisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_board_decisions_chairperson_id_fkey" FOREIGN KEY ("chairperson_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_committee_decisions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "decision" TEXT,
    "approved_amount" REAL NOT NULL DEFAULT 0,
    "chairperson_name" TEXT,
    "chairperson_id" INTEGER,
    "signature_path" TEXT,
    "decision_date" DATETIME,
    "comments" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_committee_decisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_committee_decisions_chairperson_id_fkey" FOREIGN KEY ("chairperson_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_consents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "consent_role" TEXT NOT NULL,
    "person_name" TEXT,
    "telephone" TEXT,
    "signature_path" TEXT,
    "consent_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_consents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_disbursements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "loan_id" INTEGER,
    "amount_disbursed" REAL NOT NULL,
    "disbursement_date" DATETIME NOT NULL,
    "disbursement_method" TEXT DEFAULT 'Cash',
    "reference_number" TEXT,
    "disbursed_by" INTEGER,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_disbursements_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_disbursements_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_disbursements_disbursed_by_fkey" FOREIGN KEY ("disbursed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "document_type" TEXT,
    "document_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "uploaded_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_fines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loan_id" INTEGER NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "fine_amount" REAL NOT NULL,
    "fine_rate" REAL DEFAULT 5,
    "reason" TEXT DEFAULT 'Late payment fine',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "paid_amount" REAL DEFAULT 0,
    "paid_date" DATETIME,
    "waived_by" INTEGER,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_fines_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_fines_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "loan_repayment_schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_guarantors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "guarantor_order" INTEGER NOT NULL DEFAULT 1,
    "full_name" TEXT NOT NULL,
    "account_number" TEXT,
    "telephone" TEXT,
    "member_id" INTEGER,
    "signature_path" TEXT,
    "consent_text" TEXT,
    "consent_date" DATETIME,
    "guarantee_status" TEXT DEFAULT 'Active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_guarantors_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_guarantors_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_repayment_schedules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "loan_id" INTEGER,
    "installment_no" INTEGER NOT NULL,
    "due_date" DATETIME NOT NULL,
    "principal_amount" REAL DEFAULT 0,
    "interest_amount" REAL DEFAULT 0,
    "total_amount" REAL DEFAULT 0,
    "balance" REAL DEFAULT 0,
    "fine_amount" REAL DEFAULT 0,
    "amount_paid" REAL DEFAULT 0,
    "status" TEXT DEFAULT 'Pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_repayment_schedules_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_repayment_schedules_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loan_id" INTEGER NOT NULL,
    "amount_paid" REAL NOT NULL,
    "fine_paid" REAL DEFAULT 0,
    "balance_after" REAL NOT NULL DEFAULT 0,
    "payment_date" DATETIME NOT NULL,
    "recorded_by" INTEGER,
    "reference_number" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_repayments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_securities" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "permanent_home" TEXT,
    "village" TEXT,
    "parish" TEXT,
    "sub_county" TEXT,
    "county" TEXT,
    "district" TEXT,
    "residential_address" TEXT,
    "security_location" TEXT,
    "security_ownership" TEXT,
    "market_price" REAL DEFAULT 0,
    "security_description" TEXT,
    "estimated_value" REAL DEFAULT 0,
    "total_security_value" REAL DEFAULT 0,
    "lc_confirmation" TEXT,
    "security_boundaries" TEXT,
    "supporting_document" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_securities_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loan_spouse_consents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_id" INTEGER NOT NULL,
    "spouse_name" TEXT,
    "approved_amount" REAL DEFAULT 0,
    "amount_words" TEXT,
    "telephone" TEXT,
    "signature_path" TEXT,
    "consent_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_spouse_consents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT DEFAULT 'info',
    "link" TEXT,
    "is_read" BOOLEAN DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "savings_ledger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "withdrawal_fee" REAL DEFAULT 0,
    "balance_after" REAL NOT NULL DEFAULT 0,
    "narration" TEXT,
    "reference_number" TEXT,
    "recorded_by" INTEGER,
    "transaction_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "savings_ledger_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "savings_ledger_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "savings_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "interest_rate" REAL NOT NULL DEFAULT 0,
    "min_balance" REAL NOT NULL DEFAULT 0,
    "daily_withdrawal_limit" REAL NOT NULL DEFAULT 0,
    "approval_above" REAL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "shares_ledger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "transaction_type" TEXT NOT NULL DEFAULT 'Purchase',
    "shares_quantity" INTEGER NOT NULL DEFAULT 0,
    "share_price" REAL NOT NULL DEFAULT 0,
    "total_amount" REAL NOT NULL DEFAULT 0,
    "narration" TEXT,
    "reference_number" TEXT,
    "recorded_by" INTEGER,
    "transaction_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shares_ledger_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER,
    "phone_number" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "provider_msg_id" TEXT,
    "provider_response" TEXT,
    "error_message" TEXT,
    "sent_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" DATETIME,
    CONSTRAINT "sms_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sms_logs_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sms_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "template_name" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "message_body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "members_member_code_key" ON "members"("member_code");

-- CreateIndex
CREATE UNIQUE INDEX "account_types_type_name_key" ON "account_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_setting_key_key" ON "app_settings"("setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_account_code_key" ON "chart_of_accounts"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_account_no_key" ON "customers"("account_no");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_accounts_fixed_code_key" ON "fixed_accounts"("fixed_code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entry_code_key" ON "journal_entries"("entry_code");

-- CreateIndex
CREATE UNIQUE INDEX "loans_loan_code_key" ON "loans"("loan_code");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_application_code_key" ON "loan_applications"("application_code");

-- CreateIndex
CREATE UNIQUE INDEX "loan_agreements_application_id_key" ON "loan_agreements"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_appraisals_application_id_key" ON "loan_appraisals"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_board_decisions_application_id_key" ON "loan_board_decisions"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_committee_decisions_application_id_key" ON "loan_committee_decisions"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_fines_schedule_id_key" ON "loan_fines"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_spouse_consents_application_id_key" ON "loan_spouse_consents"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_products_product_code_key" ON "savings_products"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "sms_settings_setting_key_key" ON "sms_settings"("setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "sms_templates_template_key_key" ON "sms_templates"("template_key");
