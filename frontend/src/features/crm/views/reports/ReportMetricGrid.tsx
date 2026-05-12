'use client';

import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { Box, Card, Paper, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { ReportsOverview } from './report-types';
import { metricNumber } from './report-utils';

const panel = '#ffffff';
const green = '#2d6a2d';
const greenDark = '#162716';
const line = '#e0ede0';
const tint = '#eef7ee';
const danger = '#d32f2f';

function metricVisual(report: string): { icon: ReactNode; badge: string; accent?: string; iconBg?: string } {
  switch (report) {
    case 'Total Leads':
      return { icon: <GroupsOutlinedIcon fontSize="small" />, badge: 'Leads' };
    case 'Converted':
      return { icon: <TrendingUpOutlinedIcon fontSize="small" />, badge: 'Won' };
    case 'Open Tasks':
      return { icon: <TaskAltOutlinedIcon fontSize="small" />, badge: 'Open' };
    case 'Conversion Rate':
      return { icon: <AssessmentOutlinedIcon fontSize="small" />, badge: 'Rate' };
    case 'Automation Runs':
      return { icon: <AutoAwesomeOutlinedIcon fontSize="small" />, badge: 'Runs' };
    case 'Automation Success':
      return { icon: <CheckCircleOutlineIcon fontSize="small" />, badge: 'Success' };
    case 'Failed Steps':
      return { icon: <ErrorOutlineIcon fontSize="small" />, badge: 'Action', accent: danger, iconBg: '#ffebee' };
    case 'Pending Steps':
      return { icon: <HourglassEmptyOutlinedIcon fontSize="small" />, badge: 'Pending' };
    default:
      return { icon: <AssessmentOutlinedIcon fontSize="small" />, badge: 'Report' };
  }
}

export function ReportMetricGrid({
  metrics,
  openDrilldown
}: {
  metrics: ReportsOverview['metrics'];
  openDrilldown: (metric: string, title: string) => void;
}) {
  const cards: Array<[string, string | number, string]> = [
    ['Total Leads', metricNumber(metrics, 'totalLeads'), 'totalLeads'],
    ['Converted', metricNumber(metrics, 'convertedLeads'), 'convertedLeads'],
    ['Open Tasks', metricNumber(metrics, 'openTasks'), 'openTasks'],
    ['Conversion Rate', `${metricNumber(metrics, 'conversionRate')}%`, 'convertedLeads'],
    ['Automation Runs', metricNumber(metrics, 'automationRunsTotal'), 'automationRunsTotal'],
    ['Automation Success', `${metricNumber(metrics, 'automationSuccessRate')}%`, 'automationRunsTotal'],
    ['Failed Steps', metricNumber(metrics, 'automationStepsFailed'), 'automationRunsFailed'],
    ['Pending Steps', metricNumber(metrics, 'automationStepsPending'), 'automationRunsTotal']
  ];
  const primaryCards = cards.slice(0, 4);
  const secondaryCards = cards.slice(4);

  return (
    <Stack spacing={0.8}>
      <Box
        sx={{
          display: 'grid',
          gap: 0.85,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }
        }}
      >
      {primaryCards.map(([report, value, metric]) => {
        const visual = metricVisual(report);
        const accent = visual.accent ?? green;
        return (
          <Card
            key={report}
            onClick={() => openDrilldown(metric, report)}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 1,
              border: `1px solid ${line}`,
              bgcolor: panel,
              minHeight: 88,
              p: 0.95,
              cursor: 'pointer',
              boxShadow: '0 8px 22px rgba(22, 39, 22, 0.03)',
              transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
              '&:before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${tint} 0%, rgba(255,255,255,0) 58%)`,
                pointerEvents: 'none'
              },
              '&:after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: 3,
                height: '100%',
                bgcolor: accent
              },
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: accent,
                boxShadow: '0 14px 28px rgba(22, 39, 22, 0.08)'
              }
            }}
          >
            <Stack spacing={0.75} sx={{ position: 'relative', zIndex: 1, height: '100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    color: accent,
                    bgcolor: visual.iconBg ?? tint,
                    border: `1px solid ${line}`
                  }}
                >
                  {visual.icon}
                </Box>
                <Typography
                  component="span"
                  sx={{
                    px: 0.9,
                    py: 0.25,
                    borderRadius: 999,
                    bgcolor: visual.iconBg ?? tint,
                    color: accent,
                    border: `1px solid ${line}`,
                    fontSize: 11,
                    fontWeight: 800,
                    lineHeight: 1.4
                  }}
                >
                  {visual.badge}
                </Typography>
              </Stack>
              <Box>
                <Typography color="text.secondary" fontWeight={800} fontSize={12}>
                  {report}
                </Typography>
                <Typography sx={{ mt: 0.15, fontSize: 25, fontWeight: 900, color: greenDark, letterSpacing: 0 }}>
                  {String(value)}
                </Typography>
              </Box>
            </Stack>
          </Card>
        );
      })}
      </Box>
      <Paper
        variant="outlined"
        sx={{
          borderColor: line,
          borderRadius: 1,
          bgcolor: '#fbfefb',
          p: 0.45,
          display: 'grid',
          gap: 0.45,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }
        }}
      >
        {secondaryCards.map(([report, value, metric]) => {
          const visual = metricVisual(report);
          const accent = visual.accent ?? green;
          return (
            <Box
              key={report}
              component="button"
              type="button"
              onClick={() => openDrilldown(metric, report)}
              sx={{
                border: 0,
                borderRadius: 1,
                bgcolor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                p: 0.75,
                cursor: 'pointer',
                textAlign: 'left',
                '&:hover': { bgcolor: tint }
              }}
            >
              <Stack direction="row" spacing={0.7} alignItems="center" sx={{ minWidth: 0 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1, display: 'grid', placeItems: 'center', color: accent, bgcolor: visual.iconBg ?? tint }}>
                  {visual.icon}
                </Box>
                <Typography fontWeight={850} fontSize={12.5} color="text.secondary" noWrap>{report}</Typography>
              </Stack>
              <Typography fontWeight={900} fontSize={17} color={accent}>{String(value)}</Typography>
            </Box>
          );
        })}
      </Paper>
    </Stack>
  );
}
