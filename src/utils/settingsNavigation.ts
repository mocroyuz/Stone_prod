import { navigate } from "../hooks/useHashRoute";

export function navigateToSettingsSection(section: "channels") {
  navigate(`settings?section=${section}`);
}
