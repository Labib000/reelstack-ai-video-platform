/** Real uploads have MongoDB ids; placeholder catalogue videos have slugs. */
export const isUploadId = (id: string) => /^[0-9a-f]{24}$/.test(id)
