import { FieldOption } from '../../../../lib/field-metadata';

export function buildTaskFieldOptions({
  userNames = [],
  taskTypes = ['Follow-up', 'Callback', 'Document Collection', 'Call', 'Meeting', 'Reminder'],
  taskStatuses = ['Pending', 'In Progress', 'Completed']
}: {
  userNames?: string[];
  taskTypes?: string[];
  taskStatuses?: string[];
} = {}): FieldOption[] {
  return [
    { key: 'lead', label: 'Lead', fieldType: 'text' },
    { key: 'taskType', label: 'Type', fieldType: 'select', options: taskTypes },
    { key: 'priority', label: 'Priority', fieldType: 'select', options: ['Low', 'Medium', 'High'] },
    { key: 'status', label: 'Status', fieldType: 'select', options: [...taskStatuses, 'Missed'] },
    { key: 'dueDate', label: 'Due', fieldType: 'date' },
    { key: 'assignedTo', label: 'Assigned To', fieldType: 'select', options: userNames },
    { key: 'remarks', label: 'Remarks', fieldType: 'text' },
    { key: 'action', label: 'Action', fieldType: 'text' }
  ];
}
