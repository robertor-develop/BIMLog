import { useQuery } from "@tanstack/react-query";
import { uniqueProjectCompanyLabels } from "@workspace/api-zod";
import { useAuthStore } from "@/store/auth";

export function useProjectCompanyChoices(projectId: number) {
  const { token, user } = useAuthStore();
  const query = useQuery({
    queryKey: ["project-company-choices", projectId, user?.id],
    enabled: Number.isSafeInteger(projectId) && projectId > 0 && Boolean(token),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/company-options`, { signal, headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Project company choices could not be loaded");
      const body = await response.json();
      if (!Array.isArray(body.companies)) throw new Error("Invalid project company choices");
      return uniqueProjectCompanyLabels(body.companies);
    },
  });
  return { companies: token ? query.data ?? [] : [], loading: query.isPending, error: query.isError, refresh: query.refetch };
}
