import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const seedDemoAutomation = process.env.SEED_DEMO_AUTOMATION === 'true';
const seedDemoData = process.env.SEED_DEMO_DATA === 'true' || process.env.NODE_ENV !== 'production';

const leadStatusValues = ['New', 'Assigned', 'In Progress', 'Converted', 'Expired', 'No Response'];
const leadCategoryValues = ['Hot Lead', 'Warm Lead', 'Cold Lead', 'Callback Requested', 'Need More Details', 'Not Interested', 'Wrong Number', 'Already Applied', 'Converted', 'Expired', 'No Response'];
const leadDispositionValues = ['Converted', 'Interested', 'Follow-up Required', 'Callback Scheduled', 'Documents Pending', 'Not Interested', 'Not Reachable', 'Wrong Number', 'Escalated'];
const dispositionFormFields = [
  { fieldKey: 'disposition', label: 'Disposition', fieldType: 'select', isRequired: true, isActive: true },
  { fieldKey: 'callbackAt', label: 'Callback Date/Time', fieldType: 'datetime', isRequired: false, isActive: true },
  { fieldKey: 'remarks', label: 'Remarks', fieldType: 'text', isRequired: false, isActive: true }
];

async function main() {
  const roles = await Promise.all(
    ['Administrator', 'Sales Manager', 'Sales User'].map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, isSystem: true }
      })
    )
  );

  const administratorRole = roles.find((role) => role.name === 'Administrator');
  if (!administratorRole) {
    throw new Error('Administrator role was not created');
  }

  const defaultTeam = await prisma.team.upsert({
    where: { name: 'Default Team' },
    update: {},
    create: {
      name: 'Default Team',
      code: 'DEFAULT',
      type: 'internal'
    }
  });

  const keralaTeam = await prisma.team.upsert({
    where: { name: 'Kerala Partner' },
    update: {},
    create: {
      name: 'Kerala Partner',
      code: 'KER-PARTNER',
      type: 'partner'
    }
  });

  const bengaluruTeam = await prisma.team.upsert({
    where: { name: 'Bengaluru Partner' },
    update: {},
    create: {
      name: 'Bengaluru Partner',
      code: 'BLR-PARTNER',
      type: 'partner'
    }
  });

  const hyderabadTeam = await prisma.team.upsert({
    where: { name: 'Hyderabad East' },
    update: {
      code: 'HYD-08',
      type: 'branch',
      isActive: true
    },
    create: {
      name: 'Hyderabad East',
      code: 'HYD-08',
      type: 'branch'
    }
  });

  const callbacksGroup = await prisma.salesGroup.upsert({
    where: { name: 'Callbacks' },
    update: {},
    create: { name: 'Callbacks' }
  });

  const permissionTemplate = await prisma.permissionTemplate.upsert({
    where: { name: 'Administrator Full Access' },
    update: {},
    create: {
      name: 'Administrator Full Access',
      description: 'Default full-access permission template for administrators',
      isSystem: true
    }
  });

  const salesUserPermissionTemplate = await prisma.permissionTemplate.upsert({
    where: { name: 'Sales User Standard Access' },
    update: {},
    create: {
      name: 'Sales User Standard Access',
      description: 'Standard lead access for sales users with masked phone visibility',
      isSystem: true
    }
  });

  for (const modulePermission of [
    { moduleName: 'Lead', canView: true, canCreate: true, canEdit: true, canAssign: false, canExport: false },
    { moduleName: 'Activity', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: false },
    { moduleName: 'Task', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: false }
  ]) {
    await prisma.permissionTemplateModule.upsert({
      where: {
        permissionTemplateId_moduleName: {
          permissionTemplateId: salesUserPermissionTemplate.id,
          moduleName: modulePermission.moduleName
        }
      },
      update: modulePermission,
      create: {
        permissionTemplateId: salesUserPermissionTemplate.id,
        ...modulePermission
      }
    });
  }

  for (const fieldPermission of [
    ['Lead', 'mobile', 'masked'],
    ['Lead', 'email', 'masked'],
    ['Lead', 'offerAmount', 'visible'],
    ['Lead', 'emiAmount', 'hidden'],
    ['Lead', 'assignedUserId', 'hidden'],
    ['Lead', 'assignedTeamId', 'hidden'],
    ['Activity', 'title', 'editable'],
    ['Activity', 'notes', 'editable'],
    ['Activity', 'disposition', 'editable'],
    ['Activity', 'createdBy', 'hidden']
  ] as const) {
    await prisma.permissionTemplateField.upsert({
      where: {
        permissionTemplateId_moduleName_fieldKey: {
          permissionTemplateId: salesUserPermissionTemplate.id,
          moduleName: fieldPermission[0],
          fieldKey: fieldPermission[1]
        }
      },
      update: { access: fieldPermission[2] },
      create: {
        permissionTemplateId: salesUserPermissionTemplate.id,
        moduleName: fieldPermission[0],
        fieldKey: fieldPermission[1],
        access: fieldPermission[2]
      }
    });
  }

  const systemPassword = await bcrypt.hash('SystemUserNoLogin123!', 10);
  await prisma.user.upsert({
    where: { email: 'system@unnatify.local' },
    update: {
      roleId: administratorRole.id,
      teamId: defaultTeam.id,
      permissionTemplateId: permissionTemplate.id,
      isSystem: true,
      isActive: false
    },
    create: {
      email: 'system@unnatify.local',
      name: 'System',
      passwordHash: systemPassword,
      roleId: administratorRole.id,
      teamId: defaultTeam.id,
      permissionTemplateId: permissionTemplate.id,
      isSystem: true,
      isActive: false
    }
  });

  const salesUserRole = roles.find((role) => role.name === 'Sales User');
  const salesManagerRole = roles.find((role) => role.name === 'Sales Manager');
  if (!salesUserRole || !salesManagerRole) {
    throw new Error('Sales roles were not created');
  }

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedAdminEmail && seedAdminPassword) {
    const adminPassword = await bcrypt.hash(seedAdminPassword, 12);
    await prisma.user.upsert({
      where: { email: seedAdminEmail.toLowerCase() },
      update: {
        roleId: administratorRole.id,
        teamId: defaultTeam.id,
        permissionTemplateId: permissionTemplate.id,
        isActive: true
      },
      create: {
        email: seedAdminEmail.toLowerCase(),
        name: process.env.SEED_ADMIN_NAME ?? 'Administrator',
        phone: process.env.SEED_ADMIN_PHONE ?? null,
        passwordHash: adminPassword,
        roleId: administratorRole.id,
        teamId: defaultTeam.id,
        permissionTemplateId: permissionTemplate.id
      }
    });
  }

  if (seedDemoData) {
  const adminPassword = await bcrypt.hash('ChangeMe123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@unnatify.local' },
    update: {
      roleId: administratorRole.id,
      teamId: defaultTeam.id,
      permissionTemplateId: permissionTemplate.id,
      isActive: true
    },
    create: {
      email: 'admin@unnatify.local',
      name: 'Administrator',
      phone: '9999999999',
      passwordHash: adminPassword,
      roleId: administratorRole.id,
      teamId: defaultTeam.id,
      permissionTemplateId: permissionTemplate.id
    }
  });

  const salesUserPassword = await bcrypt.hash('ChangeMe123!', 10);
  const rahul = await prisma.user.upsert({
    where: { email: 'rahul@unnatify.local' },
    update: {
      roleId: salesUserRole.id,
      teamId: keralaTeam.id,
      permissionTemplateId: salesUserPermissionTemplate.id,
      phone: '9234567890',
      isActive: true
    },
    create: {
      email: 'rahul@unnatify.local',
      name: 'Rahul M',
      phone: '9234567890',
      passwordHash: salesUserPassword,
      roleId: salesUserRole.id,
      teamId: keralaTeam.id,
      permissionTemplateId: salesUserPermissionTemplate.id,
      isActive: true
    }
  });

  const neha = await prisma.user.upsert({
    where: { email: 'neha@unnatify.local' },
    update: {
      roleId: salesUserRole.id,
      teamId: bengaluruTeam.id,
      permissionTemplateId: salesUserPermissionTemplate.id,
      phone: '9123456789',
      isActive: true
    },
    create: {
      email: 'neha@unnatify.local',
      name: 'Neha S',
      phone: '9123456789',
      passwordHash: salesUserPassword,
      roleId: salesUserRole.id,
      teamId: bengaluruTeam.id,
      permissionTemplateId: salesUserPermissionTemplate.id,
      isActive: true
    }
  });

  await prisma.userSalesGroup.upsert({
    where: {
      userId_salesGroupId: {
        userId: rahul.id,
        salesGroupId: callbacksGroup.id
      }
    },
    update: {},
    create: {
      userId: rahul.id,
      salesGroupId: callbacksGroup.id
    }
  });

  const uploadBatch =
    (await prisma.leadUploadBatch.findFirst({ where: { fileName: 'april_offer_batch_04.csv' } })) ??
    (await prisma.leadUploadBatch.create({
      data: {
        fileName: 'april_offer_batch_04.csv',
        status: 'Completed',
        totalRows: 4,
        validRows: 4,
        invalidRows: 0,
        importedRows: 4,
        uploadedBy: 'admin@unnatify.local'
      }
    }));

  const seedLeads = [
    {
      externalLeadId: 'UL-10294',
      customerName: 'Aarav Sharma',
      mobile: '9845098450',
      email: 'aarav.sharma@gmail.com',
      branchCode: 'BLR-01',
      branchName: 'Bengaluru Central',
      teamId: bengaluruTeam.id,
      assignedUserId: neha.id,
      offerAmount: '850000',
      emiAmount: '18400',
      preferredLanguage: 'Kannada',
      location: 'Bengaluru',
      status: 'Assigned',
      category: 'Hot Lead',
      disposition: 'Interested'
    },
    {
      externalLeadId: 'UL-10295',
      customerName: 'Diya Nair',
      mobile: '9901662111',
      email: 'diya.nair@gmail.com',
      branchCode: 'COK-02',
      branchName: 'Kochi North',
      teamId: keralaTeam.id,
      assignedUserId: rahul.id,
      offerAmount: '520000',
      emiAmount: '12100',
      preferredLanguage: 'Malayalam',
      location: 'Kochi',
      status: 'In Progress',
      category: 'Callback Requested',
      disposition: 'Callback Scheduled'
    },
    {
      externalLeadId: 'UL-10296',
      customerName: 'Kabir Rao',
      mobile: '9611795983',
      email: 'kabir.rao@gmail.com',
      branchCode: 'HYD-08',
      branchName: 'Hyderabad East',
      teamId: hyderabadTeam.id,
      assignedUserId: null,
      offerAmount: '1200000',
      emiAmount: '25900',
      preferredLanguage: 'Telugu',
      location: 'Hyderabad',
      status: 'Automation Active',
      category: 'Need More Details',
      disposition: 'Documents Pending'
    }
  ];

  for (const leadData of seedLeads) {
    const existingLead = await prisma.lead.findFirst({ where: { externalLeadId: leadData.externalLeadId } });
    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            ...leadData,
            sourceBatchId: uploadBatch.id,
            uploadDate: new Date('2026-04-29T00:00:00.000Z'),
            offerExpiryDate: new Date('2026-05-10T00:00:00.000Z')
          }
        })
      : await prisma.lead.create({
          data: {
            ...leadData,
            sourceBatchId: uploadBatch.id,
            uploadDate: new Date('2026-04-29T00:00:00.000Z'),
            offerExpiryDate: new Date('2026-05-10T00:00:00.000Z')
          }
        });

    const existingActivity = await prisma.activity.findFirst({
      where: { leadId: lead.id, title: 'Initial follow-up call' }
    });

    if (!existingActivity) {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: '001',
          title: 'Initial follow-up call',
          notes: 'Seeded local activity for lead detail testing',
          disposition: lead.disposition,
          createdBy: lead.assignedUserId
        }
      });
    }

    const existingAssignment = await prisma.leadAssignment.findFirst({
      where: { leadId: lead.id, reason: 'Seed assignment' }
    });

    if (!existingAssignment) {
      await prisma.leadAssignment.create({
        data: {
          leadId: lead.id,
          assignedUserId: lead.assignedUserId,
          assignedTeamId: lead.teamId,
          reason: 'Seed assignment',
          createdBy: 'system'
        }
      });
    }
  }
  }

  const languageField = await prisma.fieldDefinition.upsert({
    where: { moduleName_fieldKey: { moduleName: 'Lead', fieldKey: 'preferred_language' } },
    update: {},
    create: {
      moduleName: 'Lead',
      fieldKey: 'preferred_language',
      label: 'Preferred Language',
      fieldType: 'select',
      isRequired: false,
      isCustom: false,
      displayOrder: 10
    }
  });

  await prisma.fieldMandatoryRule.upsert({
    where: { id: 'seed-required-mobile' },
    update: {},
    create: {
      id: 'seed-required-mobile',
      moduleName: 'Lead',
      fieldKey: 'mobile',
      context: 'lead_upload',
      isRequired: true
    }
  });

  await Promise.all([
    prisma.appSetting.upsert({
      where: { key: 'lead.status.values' },
      update: {},
      create: { key: 'lead.status.values', value: leadStatusValues }
    }),
    prisma.appSetting.upsert({
      where: { key: 'lead.category.values' },
      update: {},
      create: { key: 'lead.category.values', value: leadCategoryValues }
    }),
    prisma.appSetting.upsert({
      where: { key: 'lead.disposition.values' },
      update: {},
      create: { key: 'lead.disposition.values', value: leadDispositionValues }
    }),
    prisma.appSetting.upsert({
      where: { key: 'lead.disposition.form' },
      update: {},
      create: { key: 'lead.disposition.form', value: { fields: dispositionFormFields } }
    })
  ]);

  await prisma.assignmentRule.upsert({
    where: { id: 'seed-language-assignment-rule' },
    update: {
      name: 'Language and branch assignment',
      priority: 10,
      targetType: 'lead'
    },
    create: {
      id: 'seed-language-assignment-rule',
      name: 'Language and branch assignment',
      priority: 10,
      targetType: 'lead'
    }
  });

  await prisma.assignmentRuleCondition.upsert({
    where: { id: 'seed-language-assignment-rule-condition' },
    update: {
      fieldPath: 'lead.preferredLanguage',
      operator: 'equals',
      value: 'Telugu'
    },
    create: {
      id: 'seed-language-assignment-rule-condition',
      ruleId: 'seed-language-assignment-rule',
      fieldPath: 'lead.preferredLanguage',
      operator: 'equals',
      value: 'Telugu'
    }
  });

  await prisma.assignmentRuleAction.upsert({
    where: { id: 'seed-language-assignment-rule-action' },
    update: {
      actionType: 'assign_team_by_branch',
      config: {}
    },
    create: {
      id: 'seed-language-assignment-rule-action',
      ruleId: 'seed-language-assignment-rule',
      actionType: 'assign_team_by_branch',
      config: {}
    }
  });

  if (seedDemoAutomation) {
    const workflow = await prisma.automationWorkflow.upsert({
      where: { id: 'seed-callback-workflow' },
      update: {
        name: 'Callback Reminder',
        status: 'draft'
      },
      create: {
        id: 'seed-callback-workflow',
        name: 'Callback Reminder',
        description: 'Seed workflow showing assignment and WhatsApp steps',
        status: 'draft',
        createdBy: 'system'
      }
    });

    await prisma.automationWorkflowVersion.upsert({
      where: {
        workflowId_version: {
          workflowId: workflow.id,
          version: 1
        }
      },
      update: {},
      create: {
        workflowId: workflow.id,
        version: 1,
        isPublished: false,
        definition: {
          nodes: [
            { id: 'start', type: 'trigger', label: 'Lead Updated' },
            { id: 'assign', type: 'assignment_engine', label: 'Assignment Engine' },
            { id: 'whatsapp', type: 'whatsapp_template', label: 'WhatsApp Template' }
          ]
        }
      }
    });

    await prisma.automationRun.upsert({
      where: { id: 'seed-automation-run-001' },
      update: {
        status: 'completed',
        exitReason: 'Smoke-test seeded run completed',
        completedAt: new Date()
      },
      create: {
        id: 'seed-automation-run-001',
        workflowId: workflow.id,
        leadId: 'db1dcad9-1c28-484e-9a6f-464bcae1c6e7',
        status: 'completed',
        exitReason: 'Smoke-test seeded run completed',
        completedAt: new Date()
      }
    });

    await prisma.automationRunStep.upsert({
      where: { id: 'seed-automation-run-step-001' },
      update: {
        status: 'completed',
        output: { matched: true }
      },
      create: {
        id: 'seed-automation-run-step-001',
        runId: 'seed-automation-run-001',
        nodeId: 'trigger_lead_updated',
        nodeType: 'trigger',
        status: 'completed',
        input: { event: 'lead.updated' },
        output: { matched: true },
        startedAt: new Date(),
        endedAt: new Date()
      }
    });
  }

  await prisma.connector.upsert({
    where: { id: 'seed-mcube-connector' },
    update: {
      name: 'MCUBE Telephony',
      type: 'telephony',
      provider: 'MCUBE'
    },
    create: {
      id: 'seed-mcube-connector',
      name: 'MCUBE Telephony',
      type: 'telephony',
      provider: 'MCUBE',
      isActive: false,
      config: {
        leadRouteUrl: '/webhooks/telephony/lead-route',
        agentPopupUrl: '/webhooks/telephony/agent-popup',
        callLogUrl: '/webhooks/telephony/call-log-complete'
      }
    }
  });

  await prisma.whatsAppConnector.upsert({
    where: { id: 'seed-whatsapp-connector' },
    update: {
      name: 'WhatsApp Connector',
      provider: 'configurable'
    },
    create: {
      id: 'seed-whatsapp-connector',
      name: 'WhatsApp Connector',
      provider: 'configurable',
      isActive: false
    }
  });

  await prisma.voicebotConnector.upsert({
    where: { id: 'seed-voicebot-connector' },
    update: {
      name: 'Voicebot Connector'
    },
    create: {
      id: 'seed-voicebot-connector',
      name: 'Voicebot Connector',
      isActive: false
    }
  });

  void languageField;

  await prisma.appSetting.upsert({
    where: { key: 'two_factor_account_disabled' },
    update: {},
    create: {
      key: 'two_factor_account_disabled',
      value: false
    }
  });

  await prisma.appSetting.upsert({
    where: { key: 'phone_number_format' },
    update: {},
    create: {
      key: 'phone_number_format',
      value: { digits: 10, countryCode: false }
    }
  });
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
