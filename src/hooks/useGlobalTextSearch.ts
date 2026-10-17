import { useSyncExternalStore } from "react";
import {
  getGlobalTextSearchState,
  subscribeToGlobalTextSearch,
} from "../services/globalTextSearch";

export function useGlobalTextSearch() {
  return useSyncExternalStore(
    subscribeToGlobalTextSearch,
    getGlobalTextSearchState,
    getGlobalTextSearchState
  );
}
