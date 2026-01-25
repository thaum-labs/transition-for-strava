import { Encoder, Profile, Utils } from "@garmin/fitsdk";

export type FitOptions = {
  sportType?: number; // FIT sport type (0=generic, 1=running, 2=cycling, etc.)
  subSportType?: number; // FIT sub-sport type (0=generic, etc.)
};

export type FitStreams = {
  latlng: [number, number][];
  time?: number[]; // seconds since start
  altitude?: number[];
  heartRate?: number[];
  cadence?: number[];
  power?: number[];
  velocity?: number[]; // m/s from velocity_smooth
};

// FIT uses semicircles for position: 2^31 / 180
const SEMICIRCLES_PER_DEGREE = 11930464.711111112;

function degreesToSemicircles(degrees: number): number {
  return Math.round(degrees * SEMICIRCLES_PER_DEGREE);
}

// Haversine formula for accurate distance calculation between two GPS points
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// Map our sport type IDs to FIT profile sport names
function getSportName(sportType: number): string {
  switch (sportType) {
    case 0: return "generic";
    case 1: return "running";
    case 2: return "cycling";
    case 5: return "swimming";
    case 10: return "training";
    case 11: return "walking";
    case 15: return "rowing";
    case 17: return "hiking";
    case 21: return "eBiking";
    default: return "generic";
  }
}

export function buildFit(params: {
  activityName: string;
  startDateUtc: Date;
  streams: FitStreams;
  options?: FitOptions;
}): Uint8Array {
  const { startDateUtc, streams, options = {} } = params;
  const { latlng, time, altitude, heartRate, cadence, power, velocity } = streams;

  const n = latlng.length;
  if (n < 2) {
    throw new Error("FIT generation requires at least 2 GPS points.");
  }

  const hasTime = Array.isArray(time) && time.length === n;
  const hasAlt = Array.isArray(altitude) && altitude.length === n;
  const hasHr = Array.isArray(heartRate) && heartRate.length === n;
  const hasCadence = Array.isArray(cadence) && cadence.length === n;
  const hasPower = Array.isArray(power) && power.length === n;
  const hasVelocity = Array.isArray(velocity) && velocity.length === n;

  // Convert start date to FIT timestamp
  const startTimestamp = Utils.convertDateToDateTime(startDateUtc);
  
  // Calculate total elapsed time
  const totalElapsedTime = hasTime ? time[n - 1] : n; // seconds

  // Sport settings
  const sportType = options.sportType ?? 2; // Default to cycling
  const sportName = getSportName(sportType);
  const subSport = "generic";

  // Create encoder
  const encoder = new Encoder();

  // 1. FILE_ID - Required
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: "activity",
    manufacturer: "development",
    product: 1,
    timeCreated: startTimestamp,
    serialNumber: 12345,
  });

  // 2. DEVICE_INFO - Best practice
  encoder.onMesg(Profile.MesgNum.DEVICE_INFO, {
    deviceIndex: "creator",
    manufacturer: "development",
    product: 1,
    productName: "Transition for Strava",
    serialNumber: 12345,
    softwareVersion: 1.0,
    timestamp: startTimestamp,
  });

  // 3. EVENT - Timer start
  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: startTimestamp,
    event: "timer",
    eventType: "start",
  });

  // 4. RECORD messages - One per GPS point
  // Track metrics for SESSION/LAP summary
  let lastTimestamp = startTimestamp;
  let totalDistance = 0;
  let maxSpeed = 0; // m/s
  let totalHeartRate = 0;
  let heartRateCount = 0;
  let elevationGain = 0;
  let lastAltitude: number | undefined;

  for (let i = 0; i < n; i++) {
    const [lat, lon] = latlng[i];
    const timestamp = hasTime ? startTimestamp + time[i] : startTimestamp + i;
    
    // Calculate distance from previous point using Haversine formula
    let segmentDistance = 0;
    if (i > 0) {
      const [prevLat, prevLon] = latlng[i - 1];
      segmentDistance = haversineDistance(prevLat, prevLon, lat, lon);
      totalDistance += segmentDistance;
    }

    // Calculate speed (m/s) - prefer velocity_smooth if available, otherwise calculate from distance/time
    let currentSpeed = 0;
    if (hasVelocity && velocity[i] !== undefined && velocity[i] > 0) {
      currentSpeed = velocity[i];
    } else if (hasTime && i > 0 && time[i] !== undefined && time[i - 1] !== undefined) {
      const timeDelta = time[i] - time[i - 1];
      if (timeDelta > 0) {
        currentSpeed = segmentDistance / timeDelta;
      }
    }
    if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;

    // Track heart rate for average
    if (hasHr && heartRate[i] !== undefined && heartRate[i] > 0) {
      totalHeartRate += heartRate[i];
      heartRateCount++;
    }

    // Calculate elevation gain
    if (hasAlt && altitude[i] !== undefined) {
      const currentAlt = altitude[i];
      if (lastAltitude !== undefined && currentAlt > lastAltitude) {
        elevationGain += currentAlt - lastAltitude;
      }
      lastAltitude = currentAlt;
    }

    const record: Record<string, unknown> = {
      timestamp: timestamp,
      positionLat: degreesToSemicircles(lat),
      positionLong: degreesToSemicircles(lon),
      distance: totalDistance,
    };

    if (hasAlt) {
      record.enhancedAltitude = altitude[i];
    }
    if (hasHr && heartRate[i] !== undefined) {
      record.heartRate = Math.round(heartRate[i]);
    }
    if (hasCadence && cadence[i] !== undefined) {
      record.cadence = Math.round(cadence[i]);
    }
    if (hasPower && power[i] !== undefined) {
      record.power = Math.round(power[i]);
    }
    if (currentSpeed > 0) {
      record.speed = currentSpeed; // m/s
    }

    encoder.onMesg(Profile.MesgNum.RECORD, record);
    lastTimestamp = timestamp;
  }

  // Calculate average metrics
  const averageSpeed = totalElapsedTime > 0 ? totalDistance / totalElapsedTime : 0; // m/s
  const averageHeartRate = heartRateCount > 0 ? Math.round(totalHeartRate / heartRateCount) : undefined;

  // 5. EVENT - Timer stop
  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: lastTimestamp,
    event: "timer",
    eventType: "stop",
  });

  // 6. LAP - Required (include summary metrics)
  const lapMessage: Record<string, unknown> = {
    messageIndex: 0,
    timestamp: lastTimestamp,
    startTime: startTimestamp,
    totalElapsedTime: totalElapsedTime,
    totalTimerTime: totalElapsedTime,
    totalDistance: totalDistance,
    sport: sportName,
    subSport: subSport,
    avgSpeed: averageSpeed, // m/s
    maxSpeed: maxSpeed, // m/s
  };

  if (elevationGain > 0) {
    lapMessage.totalAscent = Math.round(elevationGain);
  }
  if (averageHeartRate !== undefined) {
    lapMessage.avgHeartRate = averageHeartRate;
  }

  encoder.onMesg(Profile.MesgNum.LAP, lapMessage);

  // 7. SESSION - Required (includes sport type and summary metrics!)
  const sessionMessage: Record<string, unknown> = {
    messageIndex: 0,
    timestamp: lastTimestamp,
    startTime: startTimestamp,
    totalElapsedTime: totalElapsedTime,
    totalTimerTime: totalElapsedTime,
    totalDistance: totalDistance,
    sport: sportName,
    subSport: subSport,
    firstLapIndex: 0,
    numLaps: 1,
    avgSpeed: averageSpeed, // m/s
    maxSpeed: maxSpeed, // m/s
  };

  if (elevationGain > 0) {
    sessionMessage.totalAscent = Math.round(elevationGain);
  }
  if (averageHeartRate !== undefined) {
    sessionMessage.avgHeartRate = averageHeartRate;
  }

  encoder.onMesg(Profile.MesgNum.SESSION, sessionMessage);

  // 8. ACTIVITY - Required (exactly one)
  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: lastTimestamp,
    numSessions: 1,
    totalTimerTime: totalElapsedTime,
    localTimestamp: lastTimestamp + (startDateUtc.getTimezoneOffset() * -60),
  });

  // Close and return bytes
  return encoder.close();
}

// Legacy function for backward compatibility - now unused but kept for reference
export async function gpxToFitBytes(gpx: string, options?: FitOptions): Promise<Uint8Array> {
  // This function is deprecated - use buildFit directly with streams
  // Parse GPX and extract data (simplified)
  const { gpx2fitEncoder } = await import("gpx2fit");
  
  type Gpx2FitEncoderResult = {
    header?: ArrayBuffer;
    msgBuffers?: ArrayBuffer[];
    dataArrayBuffer?: ArrayBuffer[];
    trailer?: ArrayBuffer;
  };

  const encoder = (await gpx2fitEncoder(gpx)) as unknown as Gpx2FitEncoderResult;

  const parts: ArrayBuffer[] = [];
  if (encoder.header) parts.push(encoder.header);
  if (Array.isArray(encoder.msgBuffers)) parts.push(...encoder.msgBuffers);
  if (Array.isArray(encoder.dataArrayBuffer)) parts.push(...encoder.dataArrayBuffer);
  if (encoder.trailer) parts.push(encoder.trailer);

  if (parts.length === 0) {
    throw new Error("FIT generation failed: encoder produced no output.");
  }

  const total = parts.reduce((sum, b) => sum + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of parts) {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }

  console.log(`[FIT] Sport type ${options?.sportType ?? 0} requested (gpx2fit fallback - not applied)`);
  return out;
}
