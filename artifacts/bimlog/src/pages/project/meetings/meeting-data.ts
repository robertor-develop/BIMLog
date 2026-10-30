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

  if (!meetingsResponse.ok || !actionItemsResponse.ok) throw new Error(`MEETING_WORKSPACE_UNAVAILABLE:${meetingsResponse.status}:${actionItemsResponse.status}`);
  const meetings = await meetingsResponse.json();
  const actionItems = await actionItemsResponse.json();
  if (!Array.isArray(meetings) || !Array.isArray(actionItems)) throw new Error("MEETING_WORKSPACE_RESPONSE_INVALID");

  return {
    meetings: meetings as TMeeting[],
    actionItems: actionItems as TActionItem[],
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
  const response = await fetch(`${API}/projects/${projectId}/action-items/${actionItemId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`ACTION_ITEM_UPDATE_REJECTED:${response.status}`);
}
