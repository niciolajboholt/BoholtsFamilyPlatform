import { useEffect, useState } from "react";

import { Alert } from "@mui/material";

export function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert severity="warning" role="status" square>
      Du er offline. Allerede hentet indhold kan stadig vises, men ændringer
      kræver internetforbindelse.
    </Alert>
  );
}
