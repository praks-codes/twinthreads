interface ConnectionBannerProps {
  message: string | null;
  tone?: "info" | "error";
}

export function ConnectionBanner({
  message,
  tone = "info",
}: ConnectionBannerProps) {
  if (!message) return null;
  return (
    <p
      className={tone === "error" ? "banner banner--error" : "banner"}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
