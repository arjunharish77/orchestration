'use client';

import AddIcon from '@mui/icons-material/Add';
import { Button, Stack } from '@mui/material';

const green = '#2d6a2d';

export function NodePalette({ nodeTypes, onAdd, compact = false }: { nodeTypes: string[]; onAdd: (type: string) => void; compact?: boolean }) {
  return (
    <Stack direction="row" gap={0.45} flexWrap="wrap" justifyContent={compact ? 'center' : 'flex-start'}>
      {nodeTypes.map((type) => (
        <Button
          key={type}
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onAdd(type)}
          sx={{
            color: green,
            bgcolor: '#eef7ee',
            borderRadius: 1,
            minHeight: compact ? 24 : 28,
            px: compact ? 0.75 : 1,
            fontSize: compact ? 10.5 : 12
          }}
        >
          {type}
        </Button>
      ))}
    </Stack>
  );
}
