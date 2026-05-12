-- Store telephony-created activity types as stable 3-digit codes.
UPDATE "Activity" SET "type" = '012' WHERE "type" = 'Telephony Popup';
UPDATE "Activity" SET "type" = '013' WHERE "type" = 'Telephony Call';
