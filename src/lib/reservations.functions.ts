import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reservationIdSchema = z.object({ reservationId: z.string().uuid() });

export const expireReservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("expire_reservations");
    if (error) throw error;
    return { expired: data ?? 0 };
  });

export const createReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        employeeId: z.string().uuid(),
        contactId: z.string().uuid().nullable(),
        durationHours: z.union([z.literal(24), z.literal(48), z.literal(72), z.literal(168)]),
        notes: z.string().trim().max(2000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const args = {
      _property_id: data.propertyId,
      _employee_id: data.employeeId,
      _duration_hours: data.durationHours,
      ...(data.contactId ? { _contact_id: data.contactId } : {}),
      ...(data.notes ? { _notes: data.notes } : {}),
    };
    const { data: reservation, error } = await context.supabase.rpc("create_reservation", args);
    if (error) throw error;
    return reservation;
  });

export const extendReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reservationIdSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: reservation, error } = await context.supabase.rpc("extend_reservation", {
      _reservation_id: data.reservationId,
    });
    if (error) throw error;
    return reservation;
  });

export const cancelReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reservationIdSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: reservation, error } = await context.supabase.rpc("cancel_reservation", {
      _reservation_id: data.reservationId,
    });
    if (error) throw error;
    return reservation;
  });

export const convertReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reservationIdSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: contractId, error } = await context.supabase.rpc(
      "convert_reservation_to_contract",
      { _reservation_id: data.reservationId },
    );
    if (error) throw error;
    return { contractId };
  });