export type AtlasMessageMetadata = {
  createdAt: string;
};

export function atlasMessageMetadataNow(): AtlasMessageMetadata {
  return { createdAt: new Date().toISOString() };
}
