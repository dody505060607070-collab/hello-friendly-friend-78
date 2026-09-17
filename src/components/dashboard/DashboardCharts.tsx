import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const COLORS = ["hsl(var(--primary))", "hsl(var(--gold))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--success))"];

export function WeeklyOccupancyChart({ data }: { data: { week: string; occupancy: number }[] }) {
  const config = { occupancy: { label: "الإشغال %", color: "hsl(var(--primary))" } } satisfies ChartConfig;
  if (!data.length) return <EmptyChart text="لا توجد بيانات إشغال كافية بعد" />;
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="week" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="occupancy" stroke="var(--color-occupancy)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

export function UnitStatusChart({ data }: { data: { label: string; count: number }[] }) {
  const config = { count: { label: "عدد الوحدات" } } satisfies ChartConfig;
  if (!data.length) return <EmptyChart text="لا توجد وحدات مسجّلة بعد" />;
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={data} dataKey="count" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

export function ContractExpiryHeatmapChart({ data }: { data: { month: string; count: number }[] }) {
  const config = { count: { label: "عقود تنتهي", color: "hsl(var(--warning))" } } satisfies ChartConfig;
  if (!data.length) return <EmptyChart text="لا توجد عقود قريبة الانتهاء" />;
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-xl border border-dashed border-border text-[12.5px] text-muted-foreground">
      {text}
    </div>
  );
}
