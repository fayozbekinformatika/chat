import clsx from "clsx";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

export function formatLastSeen(lastSeen: string | null, isOnline: boolean) {
  if (isOnline) return "Online";
  if (!lastSeen) return "Last seen recently";

  const date = new Date(lastSeen);
  return `Last seen ${date.toLocaleString()}`;
}
