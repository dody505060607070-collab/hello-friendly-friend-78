import { Eraser, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const context = canvas.getContext("2d");
      context?.scale(ratio, ratio);
      if (context) { context.lineWidth = 2.4; context.lineCap = "round"; context.strokeStyle = getComputedStyle(canvas).color; }
    };
    resize();
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    const p = point(event);
    context?.beginPath(); context?.moveTo(p.x, p.y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    const p = point(event);
    context?.lineTo(p.x, p.y); context?.stroke();
    setHasInk(true);
  };
  const finish = () => {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasInk) onChange(canvas.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false); onChange("");
  };

  return <div className="space-y-2">
    <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-[12.5px] font-semibold"><PenLine className="size-4 text-primary" />وقّع داخل المساحة</span><Button type="button" variant="ghost" size="sm" onClick={clear}><Eraser />مسح</Button></div>
    <canvas ref={canvasRef} className="h-44 w-full touch-none rounded-lg border border-dashed border-primary/40 bg-card text-primary" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} aria-label="مساحة التوقيع الإلكتروني" />
  </div>;
}