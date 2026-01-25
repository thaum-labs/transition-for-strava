import { gpx2fitEncoder } from "gpx2fit";

type Gpx2FitEncoderResult = {
  header?: ArrayBuffer;
  msgBuffers?: ArrayBuffer[];
  dataArrayBuffer?: ArrayBuffer[];
  trailer?: ArrayBuffer;
};

export type FitOptions = {
  sportType?: number; // FIT sport type (0=generic, 1=running, 2=cycling, etc.)
};

function concatArrayBuffers(buffers: ArrayBuffer[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return out;
}

/**
 * Attempt to patch the sport type in a FIT file.
 * FIT format is complex with CRCs, so this is a best-effort approach.
 * We look for the session message (message type 18) and try to update the sport field.
 */
function patchSportType(data: Uint8Array, sportType: number): Uint8Array {
  // FIT files have a 14-byte header, then messages, then 2-byte CRC
  // This is a simplified patch - we'll search for patterns that look like session data
  // and try to inject the sport type. This may not work with all FIT parsers.
  
  // For now, we'll do a simple approach: the gpx2fit library creates a basic structure
  // where sport type defaults to 0 (generic). We'll search for the byte sequence
  // that represents the sport field in the session message and update it.
  
  // Note: This is experimental and may break FIT file integrity.
  // For proper support, use Option B (Garmin FIT SDK).
  
  const result = new Uint8Array(data);
  
  // gpx2fit typically creates files where sport is set in specific locations
  // We'll try to locate and patch it, but this is fragile
  // A more robust solution would rebuild the file with proper CRC recalculation
  
  // For now, just return the original data - sport type patching would require
  // understanding the specific FIT structure gpx2fit creates and recalculating CRCs
  // This is complex enough that Option B (Garmin SDK) is the better path
  
  // Log that sport type was requested but not applied
  console.log(`[FIT] Sport type ${sportType} requested (not yet applied - use Garmin SDK for full support)`);
  
  return result;
}

export async function gpxToFitBytes(gpx: string, options?: FitOptions): Promise<Uint8Array> {
  const encoder = (await gpx2fitEncoder(gpx)) as unknown as Gpx2FitEncoderResult;

  const parts: ArrayBuffer[] = [];
  if (encoder.header) parts.push(encoder.header);
  if (Array.isArray(encoder.msgBuffers)) parts.push(...encoder.msgBuffers);
  if (Array.isArray(encoder.dataArrayBuffer)) parts.push(...encoder.dataArrayBuffer);
  if (encoder.trailer) parts.push(encoder.trailer);

  if (parts.length === 0) {
    throw new Error("FIT generation failed: encoder produced no output.");
  }

  let result = concatArrayBuffers(parts);
  
  // Try to patch sport type if specified
  if (options?.sportType !== undefined && options.sportType !== 0) {
    result = patchSportType(result, options.sportType);
  }

  return result;
}

