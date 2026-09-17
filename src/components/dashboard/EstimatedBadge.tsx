import { Chip } from "@/components/kit/Chip";

/** شارة صغيرة توضح أن الرقم تقديري/مشتق وليس رقمًا فعليًا موثّقًا. */
export function EstimatedBadge() {
  return (
    <Chip tone="gold" className="align-middle">
      تقديري
    </Chip>
  );
}
