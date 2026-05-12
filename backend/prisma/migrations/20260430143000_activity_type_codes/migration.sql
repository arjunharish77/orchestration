-- Store activity types as stable 3-digit codes.
UPDATE "Activity" SET "type" = '001' WHERE "type" = 'Call';
UPDATE "Activity" SET "type" = '002' WHERE "type" = 'Meeting';
UPDATE "Activity" SET "type" = '003' WHERE "type" = 'Note';
UPDATE "Activity" SET "type" = '004' WHERE "type" = 'Disposition';
UPDATE "Activity" SET "type" = '005' WHERE "type" = 'WhatsApp';
UPDATE "Activity" SET "type" = '006' WHERE "type" = 'Voicebot';
UPDATE "Activity" SET "type" = '007' WHERE "type" = 'Document Shared';
UPDATE "Activity" SET "type" = '008' WHERE "type" = 'System';
UPDATE "Activity" SET "type" = '009' WHERE "type" = 'Task';
UPDATE "Activity" SET "type" = '010' WHERE "type" = 'Upload';
UPDATE "Activity" SET "type" = '011' WHERE "type" = 'Assignment';
