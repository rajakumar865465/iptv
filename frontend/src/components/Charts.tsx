'use client';

// Re-export all Recharts components from a single client-only module.
// Importing recharts directly in pages causes Next.js SSR hydration errors
// because Recharts uses browser-only APIs (ResizeObserver, getBoundingClientRect).
// All chart usage should import from this file, not directly from 'recharts'.

export {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
