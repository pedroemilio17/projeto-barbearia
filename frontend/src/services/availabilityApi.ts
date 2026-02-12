import { apiFetch } from "./api";

export type AvailabilityResponse = {
  date: string;
  bookedTimes: string[];
};

export function getAvailability(date: string) {
  return apiFetch(`/availability?date=${encodeURIComponent(date)}`) as Promise<AvailabilityResponse>;
}
