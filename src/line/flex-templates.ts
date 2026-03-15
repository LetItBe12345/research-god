export function createMediaPlayerCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "media-player", ...params };
}

export function createEventCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "event", ...params };
}

export function createAgendaCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "agenda", ...params };
}

export function createDeviceControlCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "device-control", ...params };
}

export function createAppleTvRemoteCard(params: Record<string, unknown>) {
  return { type: "bubble", kind: "appletv-remote", ...params };
}
