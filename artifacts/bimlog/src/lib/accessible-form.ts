export function accessibleFieldIds(id: string) {
  return {
    controlId: `${id}-form-item`,
    descriptionId: `${id}-form-item-description`,
    errorId: `${id}-form-item-message`,
  };
}

export function describedBy(ids: ReturnType<typeof accessibleFieldIds>, invalid: boolean) {
  return invalid ? `${ids.descriptionId} ${ids.errorId}` : ids.descriptionId;
}
