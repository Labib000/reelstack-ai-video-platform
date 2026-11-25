import type {
  AdminVideoDTO,
  AdminVideoListQuery,
  CompleteUploadInput,
  CreateUploadInput,
  OwnVideoDTO,
  Page,
  SignedPartDTO,
  UpdateVideoInput,
  UploadSessionDTO,
} from '@reelstack/shared'

import { api } from './http'

export const startUpload = (input: CreateUploadInput) => api.post<UploadSessionDTO>('/videos', input).then((r) => r.data)

export const signParts = (id: string, partNumbers: number[]) =>
  api.post<{ parts: SignedPartDTO[] }>(`/videos/${id}/parts`, { partNumbers }).then((r) => r.data.parts)

export const completeUpload = (id: string, parts: CompleteUploadInput['parts']) =>
  api.post<{ video: OwnVideoDTO }>(`/videos/${id}/complete`, { parts }).then((r) => r.data.video)

export const cancelUpload = (id: string) => api.delete(`/videos/${id}/upload`).then(() => undefined)

export const myVideos = (signal?: AbortSignal) => api.get<{ videos: OwnVideoDTO[] }>('/videos/mine', { signal }).then((r) => r.data.videos)

export const getVideo = (id: string, signal?: AbortSignal) => api.get<{ video: OwnVideoDTO }>(`/videos/${id}`, { signal }).then((r) => r.data.video)

export const updateVideo = (id: string, input: UpdateVideoInput) =>
  api.patch<{ video: OwnVideoDTO }>(`/videos/${id}`, input).then((r) => r.data.video)

export const deleteVideo = (id: string) => api.delete(`/videos/${id}`).then(() => undefined)

// ── Admin ────────────────────────────────────────────────────────────────

const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export const listAdminVideos = (query: AdminVideoListQuery, signal?: AbortSignal) =>
  api.get<Page<AdminVideoDTO>>('/admin/videos', { params: clean(query), signal }).then((r) => r.data)

export const removeVideo = (id: string, reason: string) =>
  api.post<{ video: AdminVideoDTO }>(`/admin/videos/${id}/remove`, { reason }).then((r) => r.data.video)

export const restoreVideo = (id: string) => api.post<{ video: AdminVideoDTO }>(`/admin/videos/${id}/restore`).then((r) => r.data.video)

export const reprocessVideo = (id: string) =>
  api.post<{ video: AdminVideoDTO }>(`/admin/videos/${id}/reprocess`).then((r) => r.data.video)
