"use client";

import { useEffect, useState } from "react";

type HealthCheckProps = {
  apiBaseUrl: string;
  inline?: boolean;
};

export function HealthCheck({ apiBaseUrl, inline = false }: HealthCheckProps) {
  const [status, setStatus] = useState<"healthy" | "unhealthy" | "checking">("checking");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/`, {
          method: "GET",
          cache: "no-store",
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === "ok") {
            setStatus("healthy");
          } else {
            setStatus("unhealthy");
          }
        } else {
          setStatus("unhealthy");
        }
      } catch {
        setStatus("unhealthy");
      }
    };

    // Initial check
    checkHealth();

    // Check every 20 seconds
    const intervalId = setInterval(checkHealth, 20000);

    return () => clearInterval(intervalId);
  }, [apiBaseUrl]);

  return (
    <div className={`health-check ${inline ? "health-check-inline" : ""}`} title={`Server status: ${status}`}>
      <div className={`health-indicator health-indicator-${status}`} />
      <span className="health-text">Server</span>
    </div>
  );
}
