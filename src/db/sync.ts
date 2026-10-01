import NetInfo from "@react-native-community/netinfo";
import {
  ApiError,
  getAuthToken,
  syncTodos as sendSync,
} from "@/services/api";
import {
  applyServerTodo,
  getPendingSyncOperations,
  markLocalTodoSynced,
  markSyncOperationComplete,
  markTodoSyncError,
} from "./database";

let syncInProgress = false;

export async function syncNow() {
  if (syncInProgress) return { synced: false, reason: "already-running" };

  const token = await getAuthToken();
  if (!token) return { synced: false, reason: "signed-out" };

  const network = await NetInfo.fetch();
  if (!network.isConnected) {
    return { synced: false, reason: "offline" };
  }

  syncInProgress = true;

  try {
    const operations = await getPendingSyncOperations();

    const response = await sendSync(
      operations.map((operation) => ({
        operationId: operation.operationId,
        type: operation.type,
        localId: operation.localId,
        serverId: operation.serverId,
        payload: operation.payload,
        updatedAt: operation.updatedAt,
      })),
    );

    for (const result of response.results) {
      const operation = operations.find(
        (item) => item.operationId === result.operationId,
      );

      if (!operation) continue;

      if (!result.ok) {
        await markTodoSyncError(
          operation.localId,
          result.error || "Server rejected the synchronization operation.",
        );
        continue;
      }

      if (result.todo) {
        await markLocalTodoSynced(
          operation.localId,
          result.todo.id,
          result.todo.updatedAt,
          result.todo.version,
        );

        await applyServerTodo(result.todo);
      } else if (result.gone) {
        await markLocalTodoSynced(operation.localId, null, null, null);
      }

      await markSyncOperationComplete(result.operationId);
    }

    for (const todo of response.todos) {
      await applyServerTodo(todo);
    }

    return {
      synced: true,
      operationCount: operations.length,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { synced: false, reason: "unauthorized" };
    }

    return {
      synced: false,
      reason: error instanceof Error ? error.message : "sync-failed",
    };
  } finally {
    syncInProgress = false;
  }
}
