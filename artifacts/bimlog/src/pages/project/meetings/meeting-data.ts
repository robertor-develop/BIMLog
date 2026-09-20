const API = "/api/v1";

export type MeetingRequestContext = {
  projectId: number;
  token: string;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export async function loadMeetingWorkspace<TMeeting, TActionItem>({
  projectId,
  token,
}: MeetingRequestContext): Promise<{
  meetings?: TMeeting[];
  actionItems?: TActionItem[];
}> {
  const [meetingsResponse, actionItemsResponse] = await Promise.all([
    fetch(`${API}/projects/${projectId}/meetings`, {
      headers: authHeaders(token),
    }),
    fetch(`${API}/projects/${projectId}/action-items`, {
      headers: authHeaders(token),
    }),
  ]);

  return {
    meetings: meetingsResponse.ok
      ? ((await meetingsResponse.json()) as TMeeting[])
      : undefined,
    actionItems: actionItemsResponse.ok
      ? ((await actionItemsResponse.json()) as TActionItem[])
      : undefined,
  };
}

export async function loadProjectMeetingDirectory<TDirectoryEntry>({
  projectId,
  token,
}: MeetingRequestContext): Promise<TDirectoryEntry[] | undefined> {
  const response = await fetch(`${API}/projects/${projectId}/directory`, {
    headers: authHeaders(token),
  });
  return response.ok
    ? ((await response.json()) as TDirectoryEntry[])
    : undefined;
}

export async function updateMeetingActionItem(
  { projectId, token }: MeetingRequestContext,
  actionItemId: number,
  status: string,
): Promise<void> {
  await fetch(`${API}/projects/${projectId}/action-items/${actionItemId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}
