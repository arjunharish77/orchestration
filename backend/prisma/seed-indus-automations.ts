import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeDefinition, validateAutomationDefinition } from '../src/automation/automation-utils';

const prisma = new PrismaClient();
const systemActor = 'system@unnatify.local';

type WorkflowDefinition = {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  exitCondition: Record<string, unknown>;
};

const leadStatusValues = ['New', 'Valid', 'Automation Active', 'Assigned', 'In Progress', 'Converted', 'Expired', 'No Response'];
const leadCategoryValues = [
  'Hot Lead',
  'Warm Lead',
  'Cold Lead',
  'Callback Requested',
  'Need More Details',
  'Not Interested',
  'Wrong Number',
  'Already Applied',
  'Converted',
  'Expired',
  'No Response'
];
const leadDispositionValues = [
  'Converted',
  'Interested',
  'Follow-up Required',
  'Callback Scheduled',
  'Documents Pending',
  'Not Interested',
  'Not Reachable',
  'Wrong Number',
  'Do Not Contact',
  'Already Applied',
  'Escalated',
  'No Response'
];

function node(nodeId: string, nodeType: string, label: string, config: Record<string, unknown> = {}) {
  return { nodeId, nodeType, label, config };
}

function edge(sourceNodeId: string, targetNodeId: string, label = 'Then', condition: Record<string, unknown> = {}) {
  return { edgeId: `edge_${sourceNodeId}_${targetNodeId}_${label.toLowerCase()}`, sourceNodeId, targetNodeId, label, condition };
}

function exitCondition(maxAttempts = 4) {
  return {
    stopStatuses: ['Converted', 'Expired'],
    stopDispositions: ['Not Interested', 'Wrong Number', 'Do Not Contact'],
    maxAttempts
  };
}

async function upsertSettingList(key: string, values: string[]) {
  const existing = await prisma.appSetting.findUnique({ where: { key } });
  const existingValues = Array.isArray(existing?.value) ? existing.value.map(String) : [];
  const next = Array.from(new Set([...existingValues, ...values]));
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: next },
    create: { key, value: next }
  });
}

async function upsertWhatsAppTemplate(input: {
  id: string;
  name: string;
  content: string;
  variables: Array<{ key: string; displayName: string; defaultMapping: string }>;
}) {
  const template = await prisma.whatsAppTemplate.upsert({
    where: { id: input.id },
    update: {
      name: input.name,
      category: 'MARKETING',
      language: 'en',
      content: input.content,
      availableInChat: true,
      status: 'approved'
    },
    create: {
      id: input.id,
      name: input.name,
      category: 'MARKETING',
      language: 'en',
      content: input.content,
      availableInChat: true,
      status: 'approved'
    }
  });
  await prisma.whatsAppTemplateVariable.deleteMany({ where: { templateId: template.id } });
  await prisma.whatsAppTemplateVariable.createMany({
    data: input.variables.map((variable) => ({
      templateId: template.id,
      variableKey: variable.key,
      displayName: variable.displayName,
      defaultMapping: variable.defaultMapping
    }))
  });
  return template;
}

async function upsertVoicebotTemplate() {
  const connector = await prisma.voicebotConnector.upsert({
    where: { id: 'indus-voicebot-connector' },
    update: {
      name: 'Indus Loan Voicebot Connector',
      isActive: false,
      config: { executionEnabled: false, note: 'Configure provider URL and credentials from the connector UI before production use.' }
    },
    create: {
      id: 'indus-voicebot-connector',
      name: 'Indus Loan Voicebot Connector',
      isActive: false,
      config: { executionEnabled: false, note: 'Configure provider URL and credentials from the connector UI before production use.' }
    }
  });
  const template = await prisma.voicebotTriggerTemplate.upsert({
    where: { id: 'indus-loan-offer-voicebot' },
    update: {
      connectorId: connector.id,
      name: 'Indus Loan Offer Voicebot',
      method: 'POST',
      url: 'https://voicebot.example.com/indus-loan/calls',
      headers: { Authorization: '{{voicebotToken}}' },
      bodyTemplate: {
        customerName: '{{customerName}}',
        mobile: '{{mobile}}',
        language: '{{preferredLanguage}}',
        offerAmount: '{{offerAmount}}',
        emiAmount: '{{emiAmount}}',
        branchName: '{{branchName}}',
        leadId: '{{leadId}}'
      },
      responseConfig: { responseKeyword: 'queued', providerCallIdPath: 'callId' }
    },
    create: {
      id: 'indus-loan-offer-voicebot',
      connectorId: connector.id,
      name: 'Indus Loan Offer Voicebot',
      method: 'POST',
      url: 'https://voicebot.example.com/indus-loan/calls',
      headers: { Authorization: '{{voicebotToken}}' },
      bodyTemplate: {
        customerName: '{{customerName}}',
        mobile: '{{mobile}}',
        language: '{{preferredLanguage}}',
        offerAmount: '{{offerAmount}}',
        emiAmount: '{{emiAmount}}',
        branchName: '{{branchName}}',
        leadId: '{{leadId}}'
      },
      responseConfig: { responseKeyword: 'queued', providerCallIdPath: 'callId' }
    }
  });
  await prisma.voicebotTriggerVariable.deleteMany({ where: { templateId: template.id } });
  await prisma.voicebotTriggerVariable.createMany({
    data: ['customerName', 'mobile', 'preferredLanguage', 'offerAmount', 'emiAmount', 'branchName', 'leadId', 'voicebotToken'].map((key) => ({
      templateId: template.id,
      variableKey: key,
      displayName: key.replace(/([A-Z])/g, ' $1').replace(/^\w/, (letter) => letter.toUpperCase()),
      defaultMapping: key === 'voicebotToken' ? 'secret:VOICEBOT_TOKEN' : `lead.${key}`
    }))
  });
  return template;
}

async function upsertIndusAssignmentRule() {
  const fallbackTeam = await prisma.team.findFirst({
    where: { isActive: true, code: 'DEFAULT' },
    orderBy: { createdAt: 'asc' }
  }) ?? await prisma.team.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' }
  });
  const rule = await prisma.assignmentRule.upsert({
    where: { id: 'indus-branch-assignment-rule' },
    update: {
      name: 'Indus Branch / Partner Assignment',
      priority: 20,
      targetType: 'Lead',
      isActive: true
    },
    create: {
      id: 'indus-branch-assignment-rule',
      name: 'Indus Branch / Partner Assignment',
      priority: 20,
      targetType: 'Lead',
      isActive: true
    }
  });
  await prisma.assignmentRuleCondition.deleteMany({ where: { ruleId: rule.id } });
  await prisma.assignmentRuleAction.deleteMany({ where: { ruleId: rule.id } });
  await prisma.assignmentRuleAction.createMany({
    data: [
      {
        ruleId: rule.id,
        actionType: 'assign_team_by_branch',
        config: {
          allowReassignment: true,
          counterResetKey: 'indus_branch_assignment'
        }
      },
      ...(fallbackTeam ? [{
        ruleId: rule.id,
        actionType: 'fallback_team',
        config: {
          teamId: fallbackTeam.id,
          isFallback: true,
          allowReassignment: true,
          counterResetKey: 'indus_fallback_assignment'
        }
      }] : [])
    ]
  });
  return rule;
}

async function upsertWorkflow(id: string, name: string, description: string, definition: WorkflowDefinition) {
  const normalized = validateAutomationDefinition(normalizeDefinition(definition), 'Administrator', true);
  const normalizedJson = normalized as Prisma.InputJsonValue;
  const workflow = await prisma.automationWorkflow.upsert({
    where: { id },
    update: { name, description, status: 'active' },
    create: { id, name, description, status: 'active', createdBy: systemActor }
  });
  await prisma.automationWorkflowVersion.upsert({
    where: { workflowId_version: { workflowId: workflow.id, version: 1 } },
    update: { definition: normalizedJson, isPublished: true },
    create: { workflowId: workflow.id, version: 1, definition: normalizedJson, isPublished: true }
  });
  await prisma.automationWorkflowVersion.updateMany({
    where: { workflowId: workflow.id, version: { not: 1 } },
    data: { isPublished: false }
  });
  return workflow;
}

function offerJourneyDefinition(templateIds: Record<string, string>, voicebotTemplateId: string): WorkflowDefinition {
  return {
    exitCondition: exitCondition(4),
    nodes: [
      node('trigger_upload', 'Trigger', 'Lead Uploaded', { trigger: 'Lead uploaded' }),
      node('mark_active', 'Lead Update', 'Start Loan Journey', {
        updates: [
          { field: 'status', value: 'Automation Active' },
          { field: 'category', value: 'Warm Lead' },
          { field: 'automationStatus', value: 'WhatsApp Offer Sent' }
        ]
      }),
      node('send_offer', 'WhatsApp', 'Send First Loan Offer', {
        templateId: templateIds.offer,
        variableMapping: {
          customerName: 'lead.customerName',
          offerAmount: 'lead.offerAmount',
          emiAmount: 'lead.emiAmount',
          branchName: 'lead.branchName',
          expiryDate: 'lead.offerExpiryDate'
        }
      }),
      node('wait_10_days', 'Delay', 'Wait 10 Days', { delayMinutes: 10, delayUnit: 'days' }),
      node('still_open', 'If/Else', 'Still Eligible For Reminder', {
        branchMode: 'all',
        fieldPath: 'lead.status',
        operator: 'not_in',
        value: 'Converted, Expired',
        groups: [
          { fieldPath: 'lead.disposition', operator: 'not_in', value: 'Not Interested, Wrong Number, Do Not Contact' }
        ]
      }),
      node('send_reminder', 'WhatsApp', 'Send WhatsApp Reminder', {
        templateId: templateIds.reminder,
        variableMapping: {
          customerName: 'lead.customerName',
          offerAmount: 'lead.offerAmount',
          expiryDate: 'lead.offerExpiryDate'
        }
      }),
      node('wait_2_days', 'Delay', 'Wait 2 Days For Response', { delayMinutes: 2, delayUnit: 'days' }),
      node('send_followup', 'WhatsApp', 'Send Follow-up Message', {
        templateId: templateIds.followup,
        variableMapping: {
          customerName: 'lead.customerName',
          branchName: 'lead.branchName',
          expiryDate: 'lead.offerExpiryDate'
        }
      }),
      node('voicebot_call', 'Voicebot', 'Trigger Voicebot Call', {
        templateId: voicebotTemplateId,
        variableMapping: {
          customerName: 'lead.customerName',
          mobile: 'lead.mobile',
          preferredLanguage: 'lead.preferredLanguage',
          offerAmount: 'lead.offerAmount',
          emiAmount: 'lead.emiAmount',
          branchName: 'lead.branchName',
          leadId: 'lead.id'
        }
      }),
      node('assign_partner', 'Assignment', 'Assign To Partner', { mode: 'full_engine' }),
      node('partner_task', 'Task', 'Create Partner Follow-up Task', {
        taskType: 'Callback',
        priority: 'High',
        dueInDays: 1,
        remarks: 'Follow up Indus loan offer for {{lead.customerName}}. Offer amount: {{lead.offerAmount}}.'
      }),
      node('pause_human', 'Pause', 'Pause For Human Follow-up', { reason: 'assigned_to_partner' }),
      node('stop_not_eligible', 'Stop', 'Stop Journey', { reason: 'lead_not_eligible_or_closed' })
    ],
    edges: [
      edge('trigger_upload', 'mark_active'),
      edge('mark_active', 'send_offer'),
      edge('send_offer', 'wait_10_days'),
      edge('wait_10_days', 'still_open'),
      edge('still_open', 'send_reminder', 'Yes', { branch: 'yes', result: 'true' }),
      edge('still_open', 'stop_not_eligible', 'No', { branch: 'no', result: 'false' }),
      edge('send_reminder', 'wait_2_days'),
      edge('wait_2_days', 'send_followup'),
      edge('send_followup', 'voicebot_call'),
      edge('voicebot_call', 'assign_partner'),
      edge('assign_partner', 'partner_task'),
      edge('partner_task', 'pause_human')
    ]
  };
}

function positiveResponseDefinition(templateIds: Record<string, string>): WorkflowDefinition {
  return {
    exitCondition: exitCondition(3),
    nodes: [
      node('trigger_whatsapp_reply', 'Trigger', 'WhatsApp Reply Received', { trigger: 'WhatsApp reply received' }),
      node('qualified_reply', 'If/Else', 'Interested Or Callback Reply', {
        branchMode: 'any',
        fieldPath: 'whatsapp.text',
        operator: 'contains',
        value: 'Interested',
        groups: [
          { fieldPath: 'whatsapp.text', operator: 'contains', value: 'Apply' },
          { fieldPath: 'whatsapp.text', operator: 'contains', value: 'Need Help' },
          { fieldPath: 'whatsapp.text', operator: 'contains', value: 'Callback' },
          { fieldPath: 'whatsapp.button', operator: 'contains', value: 'Interested' },
          { fieldPath: 'whatsapp.button', operator: 'contains', value: 'Apply' },
          { fieldPath: 'whatsapp.button', operator: 'contains', value: 'Callback' }
        ]
      }),
      node('mark_assigned', 'Lead Update', 'Mark Ready For Human Follow-up', {
        updates: [
          { field: 'status', value: 'Assigned' },
          { field: 'category', value: 'Hot Lead' },
          { field: 'disposition', value: 'Interested' },
          { field: 'automationStatus', value: 'Human Follow-up Required' }
        ]
      }),
      node('assign_partner', 'Assignment', 'Assign Partner', { mode: 'full_engine' }),
      node('send_callback_confirmation', 'WhatsApp', 'Send Callback Confirmation', {
        templateId: templateIds.callback,
        variableMapping: { customerName: 'lead.customerName', branchName: 'lead.branchName' }
      }),
      node('callback_task', 'Task', 'Create Callback Task', {
        taskType: 'Callback',
        priority: 'High',
        dueInDays: 0,
        remarks: 'Customer responded positively on WhatsApp. Call {{lead.customerName}} today.'
      }),
      node('pause_for_agent', 'Pause', 'Pause For Agent', { reason: 'positive_customer_response' }),
      node('stop_unqualified', 'Stop', 'No Human Follow-up Needed', { reason: 'not_interested_or_unqualified' })
    ],
    edges: [
      edge('trigger_whatsapp_reply', 'qualified_reply'),
      edge('qualified_reply', 'mark_assigned', 'Yes', { branch: 'yes', result: 'true' }),
      edge('qualified_reply', 'stop_unqualified', 'No', { branch: 'no', result: 'false' }),
      edge('mark_assigned', 'assign_partner'),
      edge('assign_partner', 'send_callback_confirmation'),
      edge('send_callback_confirmation', 'callback_task'),
      edge('callback_task', 'pause_for_agent')
    ]
  };
}

function voicebotIntentDefinition(): WorkflowDefinition {
  return {
    exitCondition: exitCondition(3),
    nodes: [
      node('trigger_voicebot', 'Trigger', 'Voicebot Disposition Received', { trigger: 'Voicebot disposition received' }),
      node('positive_intent', 'If/Else', 'Positive Voicebot Intent', {
        branchMode: 'any',
        fieldPath: 'voicebot.disposition',
        operator: 'in',
        value: 'Interested, Callback Scheduled, Documents Pending, Already Applied'
      }),
      node('mark_warm', 'Lead Update', 'Mark Warm Lead', {
        updates: [
          { field: 'status', value: 'Assigned' },
          { field: 'category', value: 'Warm Lead' },
          { field: 'automationStatus', value: 'Voicebot Qualified' }
        ]
      }),
      node('assign_partner', 'Assignment', 'Assign Partner', { mode: 'full_engine' }),
      node('partner_task', 'Task', 'Create Voicebot Follow-up Task', {
        taskType: 'Follow-up',
        priority: 'High',
        dueInDays: 1,
        remarks: 'Voicebot captured positive intent for {{lead.customerName}}.'
      }),
      node('pause_partner', 'Pause', 'Pause For Partner', { reason: 'voicebot_positive_intent' }),
      node('negative_intent', 'If/Else', 'Negative Voicebot Intent', {
        branchMode: 'any',
        fieldPath: 'voicebot.disposition',
        operator: 'in',
        value: 'Not Interested, Wrong Number, Do Not Contact'
      }),
      node('mark_closed', 'Lead Update', 'Close Negative Intent', {
        updates: [
          { field: 'status', value: 'Assigned' },
          { field: 'category', value: 'Not Interested' },
          { field: 'disposition', value: '{{voicebot.disposition}}' },
          { field: 'automationStatus', value: 'Voicebot Closed' }
        ]
      }),
      node('stop_voicebot', 'Stop', 'Stop Voicebot Route', { reason: 'voicebot_closed_or_no_response' })
    ],
    edges: [
      edge('trigger_voicebot', 'positive_intent'),
      edge('positive_intent', 'mark_warm', 'Yes', { branch: 'yes', result: 'true' }),
      edge('positive_intent', 'negative_intent', 'No', { branch: 'no', result: 'false' }),
      edge('mark_warm', 'assign_partner'),
      edge('assign_partner', 'partner_task'),
      edge('partner_task', 'pause_partner'),
      edge('negative_intent', 'mark_closed', 'Yes', { branch: 'yes', result: 'true' }),
      edge('negative_intent', 'stop_voicebot', 'No', { branch: 'no', result: 'false' }),
      edge('mark_closed', 'stop_voicebot')
    ]
  };
}

function expiryDefinition(): WorkflowDefinition {
  return {
    exitCondition: { stopStatuses: ['Converted'], stopDispositions: ['Not Interested', 'Wrong Number', 'Do Not Contact'], maxAttempts: 1 },
    nodes: [
      node('trigger_expiry', 'Trigger', 'Offer Expiry Reached', { trigger: 'Offer expiry reached' }),
      node('mark_expired', 'Mark Expired', 'Mark Lead Expired', { status: 'Expired' }),
      node('expiry_activity', 'Create Activity', 'Log Expiry Activity', {
        type: '008',
        title: 'Loan offer expired',
        notes: 'Offer expiry date crossed for {{lead.customerName}}.'
      }),
      node('stop_expiry', 'Stop', 'Stop Expiry Workflow', { reason: 'offer_expired' })
    ],
    edges: [
      edge('trigger_expiry', 'mark_expired'),
      edge('mark_expired', 'expiry_activity'),
      edge('expiry_activity', 'stop_expiry')
    ]
  };
}

function callbackDefinition(templateIds: Record<string, string>): WorkflowDefinition {
  return {
    exitCondition: exitCondition(3),
    nodes: [
      node('trigger_lead_updated', 'Trigger', 'Lead Updated', { trigger: 'Lead updated' }),
      node('callback_requested', 'If/Else', 'Callback Scheduled', {
        fieldPath: 'lead.disposition',
        operator: 'equals',
        value: 'Callback Scheduled',
        branchMode: 'all'
      }),
      node('send_callback_confirmation', 'WhatsApp', 'Confirm Callback', {
        templateId: templateIds.callback,
        variableMapping: { customerName: 'lead.customerName', branchName: 'lead.branchName' }
      }),
      node('callback_task', 'Task', 'Schedule Callback Task', {
        taskType: 'Callback',
        priority: 'High',
        dueInDays: 1,
        remarks: 'Callback scheduled for {{lead.customerName}} from Indus loan journey.'
      }),
      node('pause_callback', 'Pause', 'Pause Until Callback', { reason: 'callback_scheduled' }),
      node('stop_no_callback', 'Stop', 'No Callback Needed', { reason: 'callback_not_requested' })
    ],
    edges: [
      edge('trigger_lead_updated', 'callback_requested'),
      edge('callback_requested', 'send_callback_confirmation', 'Yes', { branch: 'yes', result: 'true' }),
      edge('callback_requested', 'stop_no_callback', 'No', { branch: 'no', result: 'false' }),
      edge('send_callback_confirmation', 'callback_task'),
      edge('callback_task', 'pause_callback')
    ]
  };
}

function smokeDefinition(): WorkflowDefinition {
  return {
    exitCondition: exitCondition(100),
    nodes: [
      node('trigger_smoke', 'Trigger', 'Lead Created', { trigger: 'Lead created' }),
      node('has_branch', 'If/Else', 'Has Branch Mapping', { fieldPath: 'lead.branchCode', operator: 'exists', value: '', branchMode: 'all' }),
      node('mark_smoke', 'Lead Update', 'Mark Smoke Qualified', {
        updates: [
          { field: 'status', value: 'Assigned' },
          { field: 'category', value: 'Callback Requested' },
          { field: 'automationStatus', value: 'Smoke Tested' }
        ]
      }),
      node('create_task', 'Task', 'Create Smoke Follow-up Task', {
        taskType: 'Callback',
        priority: 'Medium',
        dueInDays: 1,
        remarks: 'Smoke test callback for {{lead.customerName}}.'
      }),
      node('create_activity', 'Create Activity', 'Log Smoke Activity', {
        type: '008',
        title: 'Indus automation smoke completed',
        notes: 'Smoke workflow completed for {{lead.customerName}}.'
      }),
      node('notify', 'Notify', 'Notify Agent', {
        title: 'Indus smoke workflow completed',
        message: 'Automation smoke workflow completed for {{lead.customerName}}.'
      }),
      node('stop_smoke', 'Stop', 'Stop Smoke Workflow', { reason: 'smoke_completed' }),
      node('stop_no_branch', 'Stop', 'Stop Missing Branch', { reason: 'branch_mapping_missing' })
    ],
    edges: [
      edge('trigger_smoke', 'has_branch'),
      edge('has_branch', 'mark_smoke', 'Yes', { branch: 'yes', result: 'true' }),
      edge('has_branch', 'stop_no_branch', 'No', { branch: 'no', result: 'false' }),
      edge('mark_smoke', 'create_task'),
      edge('create_task', 'create_activity'),
      edge('create_activity', 'notify'),
      edge('notify', 'stop_smoke')
    ]
  };
}

async function upsertSmokeLead() {
  const team = await prisma.team.findFirst({ where: { isActive: true, code: { not: null } }, orderBy: { createdAt: 'asc' } });
  return prisma.lead.upsert({
    where: { id: 'indus-smoke-lead-001' },
    update: {
      customerName: 'Indus Smoke Customer',
      mobile: '9000000001',
      externalLeadId: 'INDUS-SMOKE-001',
      branchCode: team?.code ?? 'DEFAULT',
      branchName: team?.name ?? 'Default Team',
      teamId: team?.id,
      offerAmount: '750000',
      emiAmount: '15900',
      uploadDate: new Date(),
      offerExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      location: 'Mumbai',
      preferredLanguage: 'Hindi',
      partnerMapping: 'Partner A',
      status: 'Valid',
      category: 'Warm Lead',
      disposition: null,
      updatedBy: systemActor
    },
    create: {
      id: 'indus-smoke-lead-001',
      customerName: 'Indus Smoke Customer',
      mobile: '9000000001',
      externalLeadId: 'INDUS-SMOKE-001',
      branchCode: team?.code ?? 'DEFAULT',
      branchName: team?.name ?? 'Default Team',
      teamId: team?.id,
      offerAmount: '750000',
      emiAmount: '15900',
      uploadDate: new Date(),
      offerExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      location: 'Mumbai',
      preferredLanguage: 'Hindi',
      partnerMapping: 'Partner A',
      status: 'Valid',
      category: 'Warm Lead',
      createdBy: systemActor,
      updatedBy: systemActor
    }
  });
}

async function runSmokeWorkflow(leadId: string) {
  const workerAutomationPath = '../../workers/src/processors/automation';
  const workerContextPath = '../../workers/src/context';
  const { processAutomationRun } = await import(workerAutomationPath);
  const workerContext = await import(workerContextPath);
  const result = await processAutomationRun({
    data: {
      workflowId: 'indus-automation-smoke-immediate',
      input: { leadId, useDraft: false, runLabel: 'Indus Seed Smoke' },
      actor: systemActor
    }
  });
  await workerContext.prisma.$disconnect();
  await workerContext.connection.quit();
  return result;
}

async function main() {
  await Promise.all([
    upsertSettingList('lead.status.values', leadStatusValues),
    upsertSettingList('lead.category.values', leadCategoryValues),
    upsertSettingList('lead.disposition.values', leadDispositionValues)
  ]);

  const offer = await upsertWhatsAppTemplate({
    id: 'indus-wa-loan-offer',
    name: 'Indus Loan Offer',
    content: 'Hi {{customerName}}, Reliance Indus has a loan offer of Rs {{offerAmount}} for you. Estimated EMI: Rs {{emiAmount}}. Reply Apply Now, Interested, Need Help, Callback, or Not Interested.',
    variables: [
      { key: 'customerName', displayName: 'Customer Name', defaultMapping: 'lead.customerName' },
      { key: 'offerAmount', displayName: 'Loan Offer Amount', defaultMapping: 'lead.offerAmount' },
      { key: 'emiAmount', displayName: 'EMI Amount', defaultMapping: 'lead.emiAmount' },
      { key: 'branchName', displayName: 'Branch Name', defaultMapping: 'lead.branchName' },
      { key: 'expiryDate', displayName: 'Offer Expiry Date', defaultMapping: 'lead.offerExpiryDate' }
    ]
  });
  const reminder = await upsertWhatsAppTemplate({
    id: 'indus-wa-loan-reminder',
    name: 'Indus Loan Reminder',
    content: 'Hi {{customerName}}, reminder: your Reliance Indus loan offer of Rs {{offerAmount}} is still available until {{expiryDate}}. Reply Interested or Callback for help.',
    variables: [
      { key: 'customerName', displayName: 'Customer Name', defaultMapping: 'lead.customerName' },
      { key: 'offerAmount', displayName: 'Loan Offer Amount', defaultMapping: 'lead.offerAmount' },
      { key: 'expiryDate', displayName: 'Offer Expiry Date', defaultMapping: 'lead.offerExpiryDate' }
    ]
  });
  const followup = await upsertWhatsAppTemplate({
    id: 'indus-wa-loan-followup',
    name: 'Indus Loan Follow-up',
    content: 'Hi {{customerName}}, our {{branchName}} team can help complete your loan offer before {{expiryDate}}. Reply Callback to speak to an agent.',
    variables: [
      { key: 'customerName', displayName: 'Customer Name', defaultMapping: 'lead.customerName' },
      { key: 'branchName', displayName: 'Branch Name', defaultMapping: 'lead.branchName' },
      { key: 'expiryDate', displayName: 'Offer Expiry Date', defaultMapping: 'lead.offerExpiryDate' }
    ]
  });
  const callback = await upsertWhatsAppTemplate({
    id: 'indus-wa-callback-confirmation',
    name: 'Indus Callback Confirmation',
    content: 'Thanks {{customerName}}. A Reliance Indus partner from {{branchName}} will call you for the loan offer follow-up.',
    variables: [
      { key: 'customerName', displayName: 'Customer Name', defaultMapping: 'lead.customerName' },
      { key: 'branchName', displayName: 'Branch Name', defaultMapping: 'lead.branchName' }
    ]
  });
  const voicebot = await upsertVoicebotTemplate();
  const assignmentRule = await upsertIndusAssignmentRule();
  const templateIds = { offer: offer.id, reminder: reminder.id, followup: followup.id, callback: callback.id };

  await upsertWorkflow('indus-loan-upload-offer-journey', 'Indus Loan Upload To Conversion Journey', 'Lead upload to WhatsApp offer, reminder, voicebot, partner assignment, and human follow-up.', offerJourneyDefinition(templateIds, voicebot.id));
  await upsertWorkflow('indus-whatsapp-positive-response-routing', 'Indus WhatsApp Positive Response Routing', 'Routes interested WhatsApp respondents to partner assignment and callback task.', positiveResponseDefinition(templateIds));
  await upsertWorkflow('indus-voicebot-intent-routing', 'Indus Voicebot Intent Routing', 'Routes voicebot intent/disposition outcomes into warm follow-up or closed buckets.', voicebotIntentDefinition());
  await upsertWorkflow('indus-offer-expiry-cleanup', 'Indus Offer Expiry Cleanup', 'Marks expired loan offers and logs expiry activity.', expiryDefinition());
  await upsertWorkflow('indus-callback-request-followup', 'Indus Callback Request Follow-up', 'Confirms callback requests and schedules a human follow-up task.', callbackDefinition(templateIds));
  await upsertWorkflow('indus-automation-smoke-immediate', 'Indus Automation Smoke - Immediate', 'Immediate non-provider smoke workflow used to validate core automation nodes.', smokeDefinition());

  const smokeLead = await upsertSmokeLead();
  const smokeResult = process.env.RUN_INDUS_AUTOMATION_SMOKE === 'false'
    ? { skipped: true }
    : await runSmokeWorkflow(smokeLead.id);

  console.log(JSON.stringify({
    ok: true,
    workflows: [
      'indus-loan-upload-offer-journey',
      'indus-whatsapp-positive-response-routing',
      'indus-voicebot-intent-routing',
      'indus-offer-expiry-cleanup',
      'indus-callback-request-followup',
      'indus-automation-smoke-immediate'
    ],
    templates: Object.values(templateIds),
    voicebotTemplate: voicebot.id,
    assignmentRule: assignmentRule.id,
    smokeLeadId: smokeLead.id,
    smokeResult
  }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
