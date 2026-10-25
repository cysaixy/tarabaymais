/**
 * Data hooks for the Officer Portal dashboard.
 * Each hook wraps useApiQuery with the typed service function and passes
 * through the global filter params. Consumers call refetch() manually when
 * filters change (handled by the filter context).
 */

import { useApiQuery } from "./useApiQuery";
import {
  getOverview,
  getCropStages,
  getScanTrends,
  getTopIssues,
  getDisasters,
  getFarmsGeo,
  getQueue,
  getBarangays,
  type OfficerQueryParams,
  type QueueQueryParams,
  type DisastersQueryParams,
  type OverviewData,
  type CropStagesResponse,
  type ScanTrendPoint,
  type TopIssue,
  type DisastersResponse,
  type FarmsGeoResponse,
  type QueueResponse,
  type BarangayRow,
} from "../services/officerAnalytics.service";

export function useOverview(params?: OfficerQueryParams) {
  const queryKey = `overview:${JSON.stringify(params ?? {})}`;

  return useApiQuery<OverviewData>(
    () => getOverview(params),
    { staleTime: 60_000, queryKey },
  );
}

export function useCropStages(params?: OfficerQueryParams) {
  const queryKey = `crop-stages:${JSON.stringify(params ?? {})}`;

  return useApiQuery<CropStagesResponse["cropStages"]>(
    () => getCropStages(params),
    { staleTime: 60_000, queryKey },
  );
}

export function useScanTrends(params?: OfficerQueryParams) {
  const queryKey = `scan-trends:${JSON.stringify(params ?? {})}`;

  return useApiQuery<ScanTrendPoint[]>(
    () => getScanTrends(params),
    { staleTime: 60_000, queryKey },
  );
}

export function useTopIssues(params?: OfficerQueryParams) {
  const queryKey = `top-issues:${JSON.stringify(params ?? {})}`;

  return useApiQuery<TopIssue[]>(
    () => getTopIssues(params),
    { staleTime: 60_000, queryKey },
  );
}

export function useDisasters(params?: DisastersQueryParams) {
  const queryKey = `disasters:${JSON.stringify(params ?? {})}`;

  return useApiQuery<DisastersResponse["disasters"]>(
    () => getDisasters(params),
    { staleTime: 60_000, queryKey },
  );
}

export function useFarmsGeo(params?: OfficerQueryParams) {
  const queryKey = `farms-geo:${JSON.stringify(params ?? {})}`;

  return useApiQuery<FarmsGeoResponse["farmsGeo"]>(
    () => getFarmsGeo(params),
    { staleTime: 60_000, queryKey },
  );
}

export function useQueue(params?: QueueQueryParams) {
  const queryKey = `queue:${JSON.stringify(params ?? {})}`;

  return useApiQuery<QueueResponse["queue"]>(
    () => getQueue(params),
    { staleTime: 30_000, queryKey }, // queue changes faster
  );
}

export function useBarangays() {
  return useApiQuery<BarangayRow[]>(() => getBarangays(), {
    staleTime: 60_000,
    queryKey: "barangays",
  });
}
