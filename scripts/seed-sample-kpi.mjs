// Demo/sample data so the dashboard isn't empty: 2 metrics per division +
// one monthly period with entries. Safe to re-run (upserts).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
loadEnvLocal();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const now = new Date();

const { data: divisions, error: divErr } = await supabase
  .from("divisions")
  .select("id, name");
if (divErr) throw new Error(divErr.message);

const { data: period, error: periodErr } = await supabase
  .from("kpi_periods")
  .upsert(
    { period_type: "monthly", year: now.getFullYear(), month: now.getMonth() + 1 },
    { onConflict: "period_type,year,month" },
  )
  .select("id")
  .single();
if (periodErr) throw new Error(periodErr.message);

for (const division of divisions) {
  const metrics = [
    {
      division_id: division.id,
      name: "Ketepatan Waktu",
      unit: "%",
      weight: 0.6,
      target_value: 95,
      direction: "higher_better",
      source_type: "manual",
    },
    {
      division_id: division.id,
      name: "Tingkat Error",
      unit: "%",
      weight: 0.4,
      target_value: 5,
      direction: "lower_better",
      source_type: "manual",
    },
  ];

  for (const metric of metrics) {
    const { data: existing } = await supabase
      .from("kpi_metrics")
      .select("id")
      .eq("division_id", division.id)
      .eq("name", metric.name)
      .maybeSingle();

    let metricId = existing?.id;
    if (!metricId) {
      const { data: inserted, error } = await supabase
        .from("kpi_metrics")
        .insert(metric)
        .select("id")
        .single();
      if (error) throw new Error(`${division.name}/${metric.name}: ${error.message}`);
      metricId = inserted.id;
    }

    const actual =
      metric.direction === "higher_better"
        ? Math.round((82 + Math.random() * 15) * 10) / 10
        : Math.round((2 + Math.random() * 6) * 10) / 10;

    const { error: entryError } = await supabase
      .from("kpi_entries")
      .upsert(
        { metric_id: metricId, period_id: period.id, actual_value: actual },
        { onConflict: "metric_id,period_id" },
      );
    if (entryError) throw new Error(`entry ${division.name}/${metric.name}: ${entryError.message}`);
  }

  console.log(`${division.name}: ok`);
}

console.log("Sample KPI data seeded.");
