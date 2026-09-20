import {
  useCallback,
  useReducer,
  type Dispatch,
  type SetStateAction,
} from "react";

const INITIAL_AGENDA = ["", "", "", ""];

const agendaReducer = (
  current: string[],
  action: SetStateAction<string[]>,
): string[] => (typeof action === "function" ? action(current) : action);

export function useMeetingAgendaState(): [
  string[],
  Dispatch<SetStateAction<string[]>>,
] {
  const [agendaItems, dispatch] = useReducer(
    agendaReducer,
    INITIAL_AGENDA,
    (items) => [...items],
  );
  return [agendaItems, dispatch];
}

export type MeetingDraftStatus = "idle" | "saving" | "saved" | "failed";
export type MeetingDraftEvent =
  | { type: "RESET" }
  | { type: "SAVE_STARTED" }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "SAVE_FAILED" };

export const meetingDraftReducer = (
  _current: MeetingDraftStatus,
  event: MeetingDraftEvent,
): MeetingDraftStatus => {
  switch (event.type) {
    case "SAVE_STARTED":
      return "saving";
    case "SAVE_SUCCEEDED":
      return "saved";
    case "SAVE_FAILED":
      return "failed";
    case "RESET":
      return "idle";
  }
};

const eventForStatus: Record<MeetingDraftStatus, MeetingDraftEvent> = {
  idle: { type: "RESET" },
  saving: { type: "SAVE_STARTED" },
  saved: { type: "SAVE_SUCCEEDED" },
  failed: { type: "SAVE_FAILED" },
};

export function useMeetingDraftMachine(): [
  MeetingDraftStatus,
  (status: MeetingDraftStatus) => void,
] {
  const [status, dispatch] = useReducer(meetingDraftReducer, "idle");
  const transition = useCallback(
    (nextStatus: MeetingDraftStatus) => dispatch(eventForStatus[nextStatus]),
    [],
  );
  return [status, transition];
}
