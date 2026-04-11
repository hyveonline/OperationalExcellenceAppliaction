-- =============================================
-- Pre-configure EXTRA_CLEANING Workflow Steps
-- Mirrors the existing hardcoded approval chain:
--   Rule 1: Helpers + Happy store → HO → HR
--   Rule 2: Helpers + non-Happy  → AM → HO → HR
--   Rule 3: Non-helpers + Happy  → HO only
--   Rule 4: Default              → AM → HO
-- =============================================

-- 1. Update workflow type (keep IsActive=0 until admin enables it)
UPDATE WorkflowDefinitions
SET WorkflowType = 'APPROVAL', UpdatedAt = GETDATE()
WHERE FormCode = 'EXTRA_CLEANING';

DECLARE @wfId INT;
SELECT @wfId = Id FROM WorkflowDefinitions WHERE FormCode = 'EXTRA_CLEANING';

PRINT 'WorkflowDefinition Id for EXTRA_CLEANING: ' + CAST(@wfId AS VARCHAR);

-- =============================================
-- 2. Insert Workflow Steps (3 sequential approvals)
-- =============================================

-- Only insert if not already seeded
IF NOT EXISTS (SELECT 1 FROM WorkflowSteps WHERE WorkflowId = @wfId)
BEGIN
    -- Step 1: Area Manager Approval
    INSERT INTO WorkflowSteps (WorkflowId, StepOrder, StepName, StepType, ApprovalMethod, AllowedActions, IsActive)
    VALUES (@wfId, 1, 'Area Manager Approval', 'APPROVAL', 'BOTH', '["Approve","Reject"]', 1);

    -- Step 2: Head of Operations Approval
    INSERT INTO WorkflowSteps (WorkflowId, StepOrder, StepName, StepType, ApprovalMethod, AllowedActions, IsActive)
    VALUES (@wfId, 2, 'Head of Operations Approval', 'APPROVAL', 'BOTH', '["Approve","Reject"]', 1);

    -- Step 3: HR Approval
    INSERT INTO WorkflowSteps (WorkflowId, StepOrder, StepName, StepType, ApprovalMethod, AllowedActions, IsActive)
    VALUES (@wfId, 3, 'HR Approval', 'APPROVAL', 'BOTH', '["Approve","Reject"]', 1);

    PRINT 'Inserted 3 workflow steps for EXTRA_CLEANING';
END
ELSE
BEGIN
    PRINT 'Workflow steps already exist for EXTRA_CLEANING, skipping insert';
END

-- =============================================
-- 3. Insert Step Recipients (FORM_FIELD based)
-- =============================================

DECLARE @stepAM INT, @stepHO INT, @stepHR INT;
SELECT @stepAM = Id FROM WorkflowSteps WHERE WorkflowId = @wfId AND StepOrder = 1;
SELECT @stepHO = Id FROM WorkflowSteps WHERE WorkflowId = @wfId AND StepOrder = 2;
SELECT @stepHR = Id FROM WorkflowSteps WHERE WorkflowId = @wfId AND StepOrder = 3;

PRINT 'Step IDs - AM: ' + CAST(ISNULL(@stepAM,0) AS VARCHAR) + ', HO: ' + CAST(ISNULL(@stepHO,0) AS VARCHAR) + ', HR: ' + CAST(ISNULL(@stepHR,0) AS VARCHAR);

-- Only insert if not already seeded
IF NOT EXISTS (SELECT 1 FROM WorkflowStepRecipients WHERE StepId = @stepAM)
BEGIN
    -- Step 1 recipient: Area Manager (from form field)
    INSERT INTO WorkflowStepRecipients (StepId, RecipientType, FieldName, EmailTarget, IsActive)
    VALUES (@stepAM, 'FORM_FIELD', 'areaManagerEmail', 'TO', 1);

    -- Step 2 recipient: Head of Operations (from form field)
    INSERT INTO WorkflowStepRecipients (StepId, RecipientType, FieldName, EmailTarget, IsActive)
    VALUES (@stepHO, 'FORM_FIELD', 'headOfOpsEmail', 'TO', 1);

    -- Step 3 recipient: HR Responsible (from form field)
    INSERT INTO WorkflowStepRecipients (StepId, RecipientType, FieldName, EmailTarget, IsActive)
    VALUES (@stepHR, 'FORM_FIELD', 'hrEmail', 'TO', 1);

    PRINT 'Inserted 3 step recipients (FORM_FIELD) for EXTRA_CLEANING';
END
ELSE
BEGIN
    PRINT 'Step recipients already exist, skipping insert';
END

-- =============================================
-- 4. Insert Workflow Conditions
-- =============================================
-- Step 1 (AM): SKIP when store contains 'happy'
--   (Rules 1 & 3: Happy stores skip Area Manager)
-- Step 3 (HR): SKIP when category is NOT 'helpers'
--   (Rules 3 & 4: non-helpers skip HR)

IF NOT EXISTS (SELECT 1 FROM WorkflowConditions WHERE StepId = @stepAM)
BEGIN
    -- Condition: Skip AM step when store contains 'happy'
    INSERT INTO WorkflowConditions (StepId, FieldName, Operator, Value, ActionOnMatch, Priority, IsActive)
    VALUES (@stepAM, 'store', 'contains', 'happy', 'SKIP', 1, 1);

    -- Condition: Skip HR step when category is NOT 'helpers'
    INSERT INTO WorkflowConditions (StepId, FieldName, Operator, Value, ActionOnMatch, Priority, IsActive)
    VALUES (@stepHR, 'category', 'not_equals', 'helpers', 'SKIP', 1, 1);

    PRINT 'Inserted 2 workflow conditions for EXTRA_CLEANING';
END
ELSE
BEGIN
    PRINT 'Workflow conditions already exist, skipping insert';
END

-- =============================================
-- 5. Insert Status Mappings
-- =============================================

IF NOT EXISTS (SELECT 1 FROM WorkflowStatusMappings WHERE WorkflowId = @wfId)
BEGIN
    INSERT INTO WorkflowStatusMappings (WorkflowId, StatusLabel, StatusOrder, IsFinal, IsDefault, StatusColor)
    VALUES
        (@wfId, 'PendingApproval', 1, 0, 1, '#ff9800'),   -- Default status on submit
        (@wfId, 'FullyApproved',   2, 1, 0, '#4caf50'),   -- Final: all approvals done
        (@wfId, 'Rejected',        3, 1, 0, '#f44336');    -- Final: rejected at any step

    PRINT 'Inserted 3 status mappings for EXTRA_CLEANING';
END
ELSE
BEGIN
    PRINT 'Status mappings already exist, skipping insert';
END

-- =============================================
-- Summary
-- =============================================
PRINT '';
PRINT '=== EXTRA_CLEANING Workflow Configuration Complete ===';
PRINT 'WorkflowType set to APPROVAL, IsActive remains 0';
PRINT 'Enable via Admin UI when ready to switch from legacy flow';
PRINT '';
PRINT 'Approval chain rules:';
PRINT '  Rule 1: Helpers + Happy   → HO → HR (AM skipped)';
PRINT '  Rule 2: Helpers + other   → AM → HO → HR';
PRINT '  Rule 3: Other + Happy     → HO only (AM & HR skipped)';
PRINT '  Rule 4: Default           → AM → HO (HR skipped)';

-- Verify configuration
SELECT 'Steps' AS ConfigType, s.StepOrder, s.StepName, s.StepType, s.ApprovalMethod
FROM WorkflowSteps s WHERE s.WorkflowId = @wfId ORDER BY s.StepOrder;

SELECT 'Recipients' AS ConfigType, s.StepOrder, s.StepName, r.RecipientType, r.FieldName, r.EmailTarget
FROM WorkflowStepRecipients r
JOIN WorkflowSteps s ON r.StepId = s.Id
WHERE s.WorkflowId = @wfId
ORDER BY s.StepOrder;

SELECT 'Conditions' AS ConfigType, s.StepOrder, s.StepName, c.FieldName, c.Operator, c.Value, c.ActionOnMatch
FROM WorkflowConditions c
JOIN WorkflowSteps s ON c.StepId = s.Id
WHERE s.WorkflowId = @wfId
ORDER BY s.StepOrder;

SELECT 'Statuses' AS ConfigType, sm.StatusLabel, sm.StatusOrder, sm.IsFinal, sm.IsDefault, sm.StatusColor
FROM WorkflowStatusMappings sm WHERE sm.WorkflowId = @wfId ORDER BY sm.StatusOrder;
