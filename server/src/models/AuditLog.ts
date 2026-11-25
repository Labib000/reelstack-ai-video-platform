import { AUDIT_ACTIONS, type AuditAction, type AuditEntryDTO } from '@reelstack/shared';
import { Schema, Types, model } from 'mongoose';

/** Who did what to whom in the admin console. Append-only. */
const auditLogSchema = new Schema(
    {
        actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        action: { type: String, enum: AUDIT_ACTIONS, required: true },
        target: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
        /** For video actions: the video (target is then its owner). */
        video: { type: Schema.Types.ObjectId, ref: 'Video', default: null },
        meta: { type: Map, of: String, default: {} },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = model('AuditLog', auditLogSchema, 'auditLogs');

export async function audit(
    actorId: string | null,
    action: AuditAction,
    targetId: string | null,
    meta: Record<string, string> = {},
    videoId: string | null = null,
): Promise<void> {
    await AuditLog.create({
        actor: actorId ? new Types.ObjectId(actorId) : null,
        action,
        target: targetId ? new Types.ObjectId(targetId) : null,
        video: videoId ? new Types.ObjectId(videoId) : null,
        meta,
    });
}

type Person = { _id: Types.ObjectId; name: string; username?: string | null } | null;

export function toAuditEntryDTO(entry: {
    _id: Types.ObjectId;
    action: string;
    actor: Person;
    target: Person;
    video?: { _id: Types.ObjectId; title: string } | null;
    meta?: Map<string, string> | Record<string, string> | null;
    createdAt: Date;
}): AuditEntryDTO {
    const person = (p: Person) => (p ? { id: p._id.toString(), name: p.name, username: p.username ?? null } : null);
    const meta = entry.meta instanceof Map ? Object.fromEntries(entry.meta) : { ...(entry.meta ?? {}) };
    return {
        id: entry._id.toString(),
        action: entry.action as AuditAction,
        actor: person(entry.actor),
        target: person(entry.target),
        video: entry.video ? { id: entry.video._id.toString(), title: entry.video.title } : null,
        meta,
        createdAt: entry.createdAt.toISOString(),
    };
}
