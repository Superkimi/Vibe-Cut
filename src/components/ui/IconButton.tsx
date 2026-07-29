import type { Icon } from "@phosphor-icons/react";

interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: Icon;
  label: string;
  size?: number;
  active?: boolean;
}

export function IconButton({
  icon: Glyph,
  label,
  size = 18,
  active,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      data-active={active}
      {...props}
    >
      <Glyph size={size} weight="regular" aria-hidden="true" />
    </button>
  );
}
