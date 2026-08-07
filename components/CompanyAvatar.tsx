import { avatarStyle, initials } from "@/lib/ui/avatar-color";
import { cn } from "@/lib/utils";

export default function CompanyAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const { from, to } = avatarStyle(name);
  return (
    <span
      className={cn(
        "flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sm font-bold text-white",
        className,
      )}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
