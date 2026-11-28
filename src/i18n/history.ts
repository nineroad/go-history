import { useLocale } from "./context";
import { historyLabel, type HistoryLabel } from "../../shared/history-labels";

export { historyLabel, type HistoryLabel } from "../../shared/history-labels";
export function useHistoryLabels() {
  const { locale } = useLocale();
  return (key: HistoryLabel) => historyLabel(key, locale);
}
