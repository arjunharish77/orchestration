export const activityTypeCodes = {
  call: '001',
  meeting: '002',
  note: '003',
  disposition: '004',
  whatsapp: '005',
  voicebot: '006',
  documentShared: '007',
  system: '008',
  task: '009',
  upload: '010',
  assignment: '011',
  telephonyPopup: '012',
  telephonyCall: '013'
} as const;

export const legacyActivityTypeToCode: Record<string, string> = {
  Call: activityTypeCodes.call,
  Meeting: activityTypeCodes.meeting,
  Note: activityTypeCodes.note,
  Disposition: activityTypeCodes.disposition,
  WhatsApp: activityTypeCodes.whatsapp,
  Voicebot: activityTypeCodes.voicebot,
  'Document Shared': activityTypeCodes.documentShared,
  System: activityTypeCodes.system,
  Task: activityTypeCodes.task,
  Upload: activityTypeCodes.upload,
  Assignment: activityTypeCodes.assignment,
  'Telephony Popup': activityTypeCodes.telephonyPopup,
  'Telephony Call': activityTypeCodes.telephonyCall
};

export function normalizeActivityTypeCode(type: string) {
  return legacyActivityTypeToCode[type] ?? type;
}
