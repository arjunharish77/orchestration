'use client';

import MoreVertIcon from '@mui/icons-material/MoreVert';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { ReactNode, useState } from 'react';

export type RowAction = {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
};

export function RowActionMenu({ actions, ariaLabel = 'Row actions' }: { actions: RowAction[]; ariaLabel?: string }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        size="small"
        aria-label={ariaLabel}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          width: 30,
          height: 30,
          border: '1px solid',
          borderColor: '#e0ede0',
          borderRadius: '8px',
          color: 'primary.main',
          bgcolor: 'background.paper',
          '&:hover': { bgcolor: '#eef7ee', borderColor: 'primary.main' }
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 176, borderRadius: '8px', border: '1px solid #e0ede0', boxShadow: '0 14px 34px rgba(22, 39, 22, 0.14)' } } }}
      >
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={() => {
              setAnchorEl(null);
              action.onClick();
            }}
            sx={{
              color: action.tone === 'danger' ? 'error.main' : 'text.primary',
              fontWeight: 800
            }}
          >
            {action.icon ? <ListItemIcon sx={{ color: 'inherit', minWidth: 30 }}>{action.icon}</ListItemIcon> : null}
            <ListItemText primary={action.label} primaryTypographyProps={{ fontSize: 13, fontWeight: 800 }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
