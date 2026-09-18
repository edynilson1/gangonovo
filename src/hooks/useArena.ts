import { useQuery } from "@tanstack/react-query";

import { getLeaderboard, getMyHistory, getMyProfile } from "@/lib/arena.functions";

export function useMyProfile() {
  return useQuery({
    queryKey: ["arena", "me"],
    queryFn: () => getMyProfile(),
    staleTime: 10_000,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["arena", "leaderboard"],
    queryFn: () => getLeaderboard(),
    staleTime: 15_000,
  });
}

export function useMyHistory() {
  return useQuery({
    queryKey: ["arena", "history"],
    queryFn: () => getMyHistory(),
    staleTime: 15_000,
  });
}
