import { navigate } from "../hooks/useHashRoute";

export function navigateToSettingsSection(section: "channels" | "integrations") {
  navigate(`settings?section=${section}`);
}
