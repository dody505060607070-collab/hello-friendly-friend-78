import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const resolveSchema = z.object({
  mapUrl: z.string().trim().max(2000).nullable().optional(),
  hint: z.string().trim().max(300).nullable().optional(),
});

export const resolvePropertyCoordinates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => resolveSchema.parse(data))
  .handler(async ({ data }) => {
    const { resolveMapUrlToCoords } = await import("./geo.server");
    return (await resolveMapUrlToCoords(data.mapUrl ?? null, data.hint ?? null)) ?? null;
  });

export const backfillPropertyCoordinates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveMapUrlToCoords } = await import("./geo.server");
    const { data: rows, error } = await context.supabase
      .from("properties")
      .select("id, name, city, district, map_url, latitude, longitude")
      .is("latitude", null)
      .limit(200);
    if (error) throw new Error(error.message);

    let updated = 0;
    for (const row of rows ?? []) {
      const hint = [row.name, row.district, row.city, "بريدة، السعودية"]
        .filter(Boolean)
        .join("، ");
      const coords = await resolveMapUrlToCoords(row.map_url, hint);
      if (!coords) continue;
      const { error: updateError } = await context.supabase
        .from("properties")
        .update({ latitude: coords.latitude, longitude: coords.longitude })
        .eq("id", row.id);
      if (!updateError) updated += 1;
    }
    return { checked: rows?.length ?? 0, updated };
  });
