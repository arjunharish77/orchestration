'use client';

import SearchIcon from '@mui/icons-material/Search';
import { Checkbox, FormControl, InputAdornment, ListSubheader, MenuItem, Select, TextField } from '@mui/material';
import { useMemo, useState } from 'react';

export function FieldSelector({
  label = 'Fields',
  fields,
  selected,
  onChange
}: {
  label?: string;
  fields: Array<{ key: string; label: string }>;
  selected: string[];
  onChange: (fields: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const filteredFields = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return fields;
    return fields.filter((field) => `${field.label} ${field.key}`.toLowerCase().includes(value));
  }, [fields, search]);
  const allSelected = fields.length > 0 && fields.every((field) => selected.includes(field.key));

  return (
    <FormControl size="small" sx={{ minWidth: 210 }}>
      <Select
        multiple
        displayEmpty
        value={selected}
        renderValue={(values) => values.length ? `${values.length} ${label.toLowerCase()} shown` : label}
        onChange={(event) => {
          const value = event.target.value;
          const next = typeof value === 'string' ? value.split(',') : value;
          onChange(next.filter((field) => field !== '__all__'));
        }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 420, minWidth: 260 } } }}
      >
        <ListSubheader sx={{ bgcolor: '#fff', py: 0.75 }}>
          <TextField
            autoFocus
            size="small"
            placeholder="Search fields"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </ListSubheader>
        <MenuItem
          value="__all__"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onChange(allSelected ? [] : fields.map((field) => field.key));
          }}
        >
          <Checkbox size="small" checked={allSelected} indeterminate={!allSelected && selected.length > 0} />
          Show / hide all
        </MenuItem>
        {filteredFields.map((field) => (
          <MenuItem key={field.key} value={field.key}>
            <Checkbox size="small" checked={selected.includes(field.key)} />
            {field.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
