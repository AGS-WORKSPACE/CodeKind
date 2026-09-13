# Classroom integration contract

The classroom UI is provider-agnostic. Its current adapter returns delayed mock responses and never executes user code, opens media devices, or establishes realtime connections.

## Realtime event contract

| Event | Direction | Payload | Frontend behaviour |
|---|---|---|---|
| `lesson:join` | Client → server | `{ lessonId, deviceState, lastRevision? }` | Show connecting state, hydrate workspace, then enter room. |
| `lesson:leave` | Client → server | `{ lessonId, reason }` | Stop local media, preserve drafts, return to summary/dashboard. |
| `participant:joined` | Server → room | `{ participant }` | Add participant tile and system chat message. |
| `participant:left` | Server → room | `{ participantId, leftAt }` | Mark offline, retain identity in lesson history. |
| `editor:change` | Bidirectional | `{ fileId, revision, operations, authorId }` | Apply operations when revision follows local state; request resync on a gap. |
| `editor:cursor` | Bidirectional | `{ fileId, participantId, line, column }` | Render labelled remote cursor using participant colour. |
| `editor:selection` | Bidirectional | `{ fileId, participantId, start, end }` | Render translucent remote selection. |
| `chat:message` | Bidirectional | `{ id, lessonId, authorId, type, body, createdAt }` | Append once by id and announce new messages accessibly. |
| `exercise:assigned` | Server → student | `{ exercise, assignedBy, assignedAt }` | Open exercise badge/panel and preserve editor draft. |
| `exercise:submitted` | Student → server/tutor | `{ exerciseId, fileRevision, submittedAt }` | Lock submission snapshot while leaving working files editable. |
| `screen:start` | Bidirectional | `{ participantId, streamMetadata }` | Move shared screen to centre and keep video tiles floating. |
| `screen:stop` | Bidirectional | `{ participantId }` | Return centre workspace to its previous tool. |
| `lesson:ended` | Server → room | `{ endedBy, endedAt, summaryId }` | Stop media and navigate both roles to the appropriate summary. |

Clients should reconnect with the last acknowledged revision, de-duplicate events by id, and render offline drafts optimistically only where conflicts are recoverable.

## Sandboxed code execution

Suggested request:

```http
POST /api/code/run
Content-Type: application/json

{
  "language": "javascript",
  "files": [{ "path": "src/index.js", "content": "..." }],
  "entryFile": "src/index.js",
  "stdin": ""
}
```

Expected response:

```json
{
  "status": "SUCCESS",
  "stdout": ["Hello Pairlore"],
  "stderr": [],
  "executionTime": 142,
  "exitCode": 0
}
```

Possible statuses are `QUEUED`, `RUNNING`, `SUCCESS`, `ERROR`, and `TIMEOUT`. The service must enforce language-specific CPU, memory, wall-time, process, filesystem, and network restrictions.

Arbitrary user code must **never** execute inside the browser as trusted application code or directly on the main application/API server. Production execution requires an isolated, disposable sandbox or container service with strict resource and network controls.

## Video provider interface

The eventual video adapter should expose:

- `joinRoom(roomToken, localDevicePreferences)` and `leaveRoom()`;
- local mute, camera, speaker-device, and screen-share controls;
- participant joined, left, track enabled/disabled, speaking, and metadata events;
- connection quality and reconnecting/disconnected states;
- a clean teardown method that stops local tracks and listeners.

Provider media tracks should be attached inside `VideoTile`; provider state should not leak into general classroom components. Room tokens must be short-lived, lesson-scoped, and issued only to authorized lesson participants.
