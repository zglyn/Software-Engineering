export function storageUserSegment(userId: string) {
  return String(userId).trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}
