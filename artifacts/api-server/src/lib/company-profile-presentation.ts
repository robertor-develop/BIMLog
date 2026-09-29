type Binding = { id: number; name: string; website?: string | null; phone?: string | null; companyLogoUrl?: string | null };
/** Personal export branding is not company membership and never rewrites issued records. */
export function companyProfilePresentation(userId: number, binding: Binding, profile?: Record<string, unknown>) {
  return {
    userId, companyRole: null, city: null, country: null,
    ...profile,
    companyName: profile?.companyName ?? binding.name,
    website: profile?.website ?? binding.website ?? null,
    phone: profile?.phone ?? binding.phone ?? null,
    logoUrl: profile?.logoUrl ?? binding.companyLogoUrl ?? null,
    canonicalCompanyId: binding.id,
    canonicalCompanyName: binding.name,
  };
}
