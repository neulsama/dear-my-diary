export const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  return Boolean(element && (['INPUT','TEXTAREA','SELECT'].includes(element.tagName) || element.isContentEditable))
}
export const isOpenDiaryShortcut = (event: Pick<KeyboardEvent, 'altKey'|'code'|'target'>): boolean => event.altKey && event.code === 'Digit7' && !isEditableTarget(event.target)
