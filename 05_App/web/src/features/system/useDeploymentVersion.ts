import { useEffect, useState } from "react";

interface HealthResponse {
  version?: {
    id?: string;
    tag?: string;
    timestamp?: string;
  };
}

export function useDeploymentVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void fetch("/api/health", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<HealthResponse>;
      })
      .then((health) => {
        const id = health?.version?.id;
        if (!isCancelled && id) setVersion(id.slice(0, 12));
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, []);

  return version;
}
