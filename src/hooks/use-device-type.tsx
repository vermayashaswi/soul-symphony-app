
import { useLayoutEffect, useState } from "react";

// Unified device type: "mobile" | "tablet" | "desktop"
type DeviceType = "mobile" | "tablet" | "desktop";

export function getDeviceType(): DeviceType {
  const ua = navigator.userAgent.toLowerCase();

  const isIpadLike =
    /ipad/.test(ua) || (navigator.maxTouchPoints > 2 && /macintosh/.test(ua));
  const isTablet =
    /ipad|android(?!.*mobile)|tablet|kindle|silk|playbook|nexus 7|nexus 10|xoom|sch-i800|touchpad|tab|kftt|kfot|kfjw|kfsowi|kfthwi|kfapwi|kfawo/.test(
      ua
    ) || isIpadLike;
  const isMobile =
    /iphone|ipod|android.*mobile|windows phone|blackberry|bb10|opera mini|mobi|mobile safari/.test(
      ua
    ) && !isTablet;

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}

/** Hook: returns { deviceType, isMobile, isTablet, isDesktop } and logs details for debugging */
export function useDeviceType() {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");

  useLayoutEffect(() => {
    const update = () => {
      const type = getDeviceType();
      setDeviceType(type);
      if (process.env.NODE_ENV !== 'production')
        console.log("[DeviceType] Detected as", type, navigator.userAgent);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return {
    deviceType,
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",
  } as const;
}
