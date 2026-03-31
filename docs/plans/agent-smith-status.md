---
Status: COMPLETE
---
# Smith Decisions
- chat.js init contract: { messagesEl, inputEl, onToolCallCallback }
- SSE consumption via fetch + ReadableStream (not EventSource)
- Tool calls rendered as collapsible cards via tool-call.js
- Create task modal triggered by showCreateTaskModal(onCreated)
- addSystemMessage() preserved for external callers
- api.chatStream(message, onEvent) added to api.js
