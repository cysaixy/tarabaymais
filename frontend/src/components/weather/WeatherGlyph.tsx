import React from "react";
import {
  AlertTriangle,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudLightning,
  AlertTriangle,
};

/** Renders the Lucide icon named by the weather service (falls back to a cloud). */
export const WeatherGlyph: React.FC<{ name: string; className?: string }> = ({
  name,
  className,
}) => {
  const Icon = ICONS[name] ?? Cloud;
  return <Icon className={className} aria-hidden="true" />;
};
