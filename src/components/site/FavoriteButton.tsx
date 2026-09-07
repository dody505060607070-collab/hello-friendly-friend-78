import { Heart } from "lucide-react";

import { useFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({ code, className }: { code: string; className?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(code);

  return (
    <button
      type="button"
      aria-label={active ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(code);
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-white/85 text-primary shadow-md backdrop-blur transition-transform hover:scale-110",
        className,
      )}
    >
      <Heart className={cn("size-4.5", active && "fill-destructive text-destructive")} />
    </button>
  );
}
