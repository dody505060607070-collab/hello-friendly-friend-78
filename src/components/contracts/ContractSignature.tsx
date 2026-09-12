import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, Loader2, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const roleLabels: Record<string, string> = {
  tenant: "المستأجر",
  owner: "المالك",
  broker: "الوسيط",
  agency: "المكتب",
};

/** توقيع إلكتروني للعقد يُرسم بالإصبع أو الفأرة ويُحفظ كصورة */
export function ContractSignature({ contractId }: { contractId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("tenant");
  const qc = useQueryClient();

  const signatures = useQuery({
    queryKey: ["contract-signatures", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_signatures")
        .select("id, signer_name, signer_role, signature_data, signed_at")
        .eq("contract_id", contractId)
        .order("signed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!signerName.trim()) throw new Error("اكتب اسم الموقّع أولًا");
      if (!dirty) throw new Error("ارسم التوقيع في المساحة المخصصة");
      const dataUrl = canvasRef.current?.toDataURL("image/png");
      if (!dataUrl) throw new Error("تعذّر قراءة التوقيع");
      const { error } = await supabase.from("contract_signatures").insert({
        contract_id: contractId,
        signer_name: signerName.trim(),
        signer_role: signerRole,
        signature_data: dataUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التوقيع على العقد");
      setSignerName("");
      clear();
      void qc.invalidateQueries({ queryKey: ["contract-signatures", contractId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر حفظ التوقيع"),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">اسم الموقّع</span>
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="مثال: محمد بن أحمد"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">صفة الموقّع</span>
          <select
            value={signerRole}
            onChange={(e) => setSignerRole(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          >
            {Object.entries(roleLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-border bg-background"
        aria-label="مساحة الرسم للتوقيع"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
          حفظ التوقيع
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clear}>
          <Eraser className="size-4" />
          مسح
        </Button>
        <p className="text-[11.5px] text-muted-foreground">
          التوقيع يُحفظ كصورة مرتبطة بالعقد مع اسم الموقّع وتاريخه.
        </p>
      </div>

      {signatures.data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {signatures.data.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card p-3">
              <img
                src={s.signature_data}
                alt={`توقيع ${s.signer_name}`}
                className="h-20 w-full rounded-lg bg-background object-contain"
              />
              <p className="mt-2 text-[13px] font-semibold">{s.signer_name}</p>
              <p className="text-[11.5px] text-muted-foreground">
                {roleLabels[s.signer_role] ?? s.signer_role} ·{" "}
                {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(s.signed_at),
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">لا توجد توقيعات محفوظة على هذا العقد بعد.</p>
      )}
    </div>
  );
}
