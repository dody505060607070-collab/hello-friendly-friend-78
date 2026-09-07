import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("ar-SA");

/** حاسبة التمويل العقاري: القسط الشهري التقريبي. */
export function InstallmentCalculator() {
  const [price, setPrice] = useState(800000);
  const [down, setDown] = useState(15);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(4.5);

  const result = useMemo(() => {
    const loan = Math.max(price - (price * down) / 100, 0);
    const months = Math.max(years * 12, 1);
    const monthlyRate = rate / 100 / 12;
    const monthly =
      monthlyRate === 0
        ? loan / months
        : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    return { loan, monthly, total: monthly * months };
  }, [price, down, years, rate]);

  const field = "h-11 w-full rounded-lg border border-input bg-card px-3 text-[13.5px]";

  return (
    <div className="glass-panel p-6">
      <h2 className="flex items-center gap-2 text-[18px] font-bold text-foreground">
        <Calculator className="size-5 text-primary" />
        حاسبة التمويل العقاري
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        احسب القسط الشهري التقريبي قبل التواصل معنا — النتيجة تقديرية للاسترشاد فقط.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[13px] font-semibold text-foreground">
          سعر العقار (ريال)
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={`mt-1.5 ${field}`}
          />
        </label>
        <label className="block text-[13px] font-semibold text-foreground">
          الدفعة الأولى (%)
          <input
            type="number"
            min={0}
            max={90}
            value={down}
            onChange={(e) => setDown(Number(e.target.value))}
            className={`mt-1.5 ${field}`}
          />
        </label>
        <label className="block text-[13px] font-semibold text-foreground">
          مدة التمويل (سنة)
          <input
            type="number"
            min={1}
            max={30}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className={`mt-1.5 ${field}`}
          />
        </label>
        <label className="block text-[13px] font-semibold text-foreground">
          نسبة الفائدة السنوية (%)
          <input
            type="number"
            min={0}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className={`mt-1.5 ${field}`}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "القسط الشهري", value: `${fmt(result.monthly)} ريال` },
          { label: "مبلغ التمويل", value: `${fmt(result.loan)} ريال` },
          { label: "إجمالي المدفوعات", value: `${fmt(result.total)} ريال` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-[12.5px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-[17px] font-extrabold text-primary">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
