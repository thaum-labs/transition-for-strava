import { gpx2fitEncoder } from "gpx2fit";

type Gpx2FitEncoderResult = {
  header?: ArrayBuffer;
  msgBuffers?: ArrayBuffer[];
  dataArrayBuffer?: ArrayBuffer[];
  trailer?: ArrayBuffer;
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

export async function gpxToFitBytes(gpx: string): Promise<Uint8Array> {
  const encoder = (await gpx2fitEncoder(gpx)) as unknown as Gpx2FitEncoderResult;

  const parts: ArrayBuffer[] = [];
  if (encoder.header) parts.push(encoder.header);
  if (Array.isArray(encoder.msgBuffers)) parts.push(...encoder.msgBuffers);
  if (Array.isArray(encoder.dataArrayBuffer)) parts.push(...encoder.dataArrayBuffer);
  if (encoder.trailer) parts.push(encoder.trailer);

  if (parts.length === 0) {
    throw new Error("FIT generation failed: encoder produced no output.");
  }

  return concatArrayBuffers(parts);
}

