"use client";

/**
 * The chart renderers. One file because they share axis, grid and tooltip
 * conventions, and those conventions drifting apart between charts is what
 * makes a dashboard look assembled rather than designed.
 *
 * Every colour is a `var(--chart-*)` reference written into an SVG presentation
 * attribute, so the whole screen re-themes with the rest of the app and no
 * chart code runs on a theme change.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { money } from "@/lib/format";
import {
  ACCENT_COLOR,
  AXIS_COLOR,
  EXPENSE_COLOR,
  GRID_COLOR,
  INCOME_COLOR,
  NEGATIVE_COLOR,
  compactMoney,
  seriesColor,
  type ChartKind,
} from "@/lib/chart-types";

const AXIS_TICK = { fill: AXIS_COLOR, fontSize: 11 };
const GRID = { stroke: GRID_COLOR, strokeDasharray: "2 4" };

/** One tooltip for every chart — Recharts' default is a white box that ignores
 *  the theme entirely, which is glaring in dark mode. */
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label ? <p className="chart-tooltip-label">{label}</p> : null}
      {payload.map((entry, index) => (
        <p key={index} className="chart-tooltip-row">
          <span className="chart-tooltip-swatch" style={{ background: entry.color }} />
          <span className="chart-tooltip-name">{entry.name}</span>
          <span className="chart-tooltip-value">{money(entry.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

const TOOLTIP = (
  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
);

export interface TrendDatum {
  label: string;
  income: number;
  expense: number;
  net_profit: number;
}

/**
 * Income against expense over time, as a line, area or bar.
 *
 * Net profit is deliberately NOT a third series here: it is income minus
 * expense, so drawing all three puts a value and its own derivation on one
 * scale, and the reader has to work out which two of the three are independent.
 * It gets its own chart instead.
 */
export function TrendChart({ data, kind }: { data: TrendDatum[]; kind: ChartKind }) {
  const axes = (
    <>
      <CartesianGrid {...GRID} vertical={false} />
      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
      <YAxis
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        tickFormatter={compactMoney}
        width={56}
      />
      {TOOLTIP}
    </>
  );

  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {axes}
          <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "area") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.28} />
              <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-expense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={EXPENSE_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          {axes}
          <Area type="monotone" dataKey="income" name="Income" stroke={INCOME_COLOR}
                strokeWidth={2} fill="url(#fill-income)" />
          <Area type="monotone" dataKey="expense" name="Expense" stroke={EXPENSE_COLOR}
                strokeWidth={2} fill="url(#fill-expense)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        <Line type="monotone" dataKey="income" name="Income" stroke={INCOME_COLOR}
              strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="expense" name="Expense" stroke={EXPENSE_COLOR}
              strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Net profit alone — one measure, so one colour and no legend to read. */
export function NetProfitChart({ data, kind }: { data: TrendDatum[]; kind: ChartKind }) {
  const axes = (
    <>
      <CartesianGrid {...GRID} vertical={false} />
      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false}
             tickFormatter={compactMoney} width={56} />
      {TOOLTIP}
    </>
  );

  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {axes}
          <Bar dataKey="net_profit" name="Net profit" radius={[3, 3, 0, 0]}>
            {/* A loss month is dimmed rather than recoloured: the sign still
                reads at a glance, without importing a second hue into a
                deliberately blue-and-white screen. */}
            {data.map((point, index) => (
              <Cell
                key={index}
                fill={point.net_profit < 0 ? NEGATIVE_COLOR : ACCENT_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "area") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-net" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity={0.3} />
              <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          {axes}
          <Area type="monotone" dataKey="net_profit" name="Net profit"
                stroke={ACCENT_COLOR} strokeWidth={2} fill="url(#fill-net)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        <Line type="monotone" dataKey="net_profit" name="Net profit"
              stroke={ACCENT_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface CategoryDatum {
  label: string;
  amount: number;
}

/** A composition: donut for share-of-total, bar for comparing magnitudes. */
export function CategoryChart({ data, kind }: { data: CategoryDatum[]; kind: ChartKind }) {
  if (kind === "donut") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="label"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={seriesColor(index)} />
            ))}
          </Pie>
          {TOOLTIP}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical"
                margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false}
               tickFormatter={compactMoney} />
        <YAxis type="category" dataKey="label" tick={AXIS_TICK} tickLine={false}
               axisLine={false} width={132} />
        {TOOLTIP}
        <Bar dataKey="amount" name="Amount" radius={[0, 3, 3, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={seriesColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ageing buckets: receivables against payables, side by side. */
export function AgeingChart({ data }: {
  data: Array<{ bucket: string; receivable: number; payable: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false}
               tickFormatter={compactMoney} width={56} />
        {TOOLTIP}
        <Bar dataKey="receivable" name="Owed to us" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} />
        <Bar dataKey="payable" name="We owe" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
