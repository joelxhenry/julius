import { ipcMain } from 'electron';
import { eq } from 'drizzle-orm';
import { getDatabase, schema } from '../database';
import { IpcChannel } from '../../shared/types/ipc';

export function registerIpcHandlers() {
  const db = getDatabase();

  // User handlers
  ipcMain.handle(IpcChannel.GET_USERS, async () => {
    return db.select().from(schema.users).all();
  });

  ipcMain.handle(IpcChannel.GET_USER, async (_, { id }: { id: number }) => {
    const result = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    return result || null;
  });

  ipcMain.handle(IpcChannel.CREATE_USER, async (_, data: any) => {
    const result = await db.insert(schema.users).values(data).returning().get();
    return result;
  });

  ipcMain.handle(IpcChannel.UPDATE_USER, async (_, { id, data }: any) => {
    const result = await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id))
      .returning()
      .get();
    return result;
  });

  ipcMain.handle(IpcChannel.DELETE_USER, async (_, { id }: { id: number }) => {
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return { success: true };
  });

  // Note handlers
  ipcMain.handle(IpcChannel.GET_NOTES, async (_, { userId }: any) => {
    const query = db.select().from(schema.notes);
    if (userId) {
      return query.where(eq(schema.notes.userId, userId)).all();
    }
    return query.all();
  });

  ipcMain.handle(IpcChannel.GET_NOTE, async (_, { id }: { id: number }) => {
    const result = await db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.id, id))
      .get();
    return result || null;
  });

  ipcMain.handle(IpcChannel.CREATE_NOTE, async (_, data: any) => {
    const result = await db.insert(schema.notes).values(data).returning().get();
    return result;
  });

  ipcMain.handle(IpcChannel.UPDATE_NOTE, async (_, { id, data }: any) => {
    const result = await db
      .update(schema.notes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.notes.id, id))
      .returning()
      .get();
    return result;
  });

  ipcMain.handle(IpcChannel.DELETE_NOTE, async (_, { id }: { id: number }) => {
    await db.delete(schema.notes).where(eq(schema.notes.id, id));
    return { success: boolean };
  });
}
