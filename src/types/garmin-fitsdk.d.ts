declare module "@garmin/fitsdk" {
  export class Encoder {
    constructor(options?: { fieldDescriptions?: Record<string, unknown> });
    onMesg(mesgNum: number, message: Record<string, unknown>): void;
    writeMesg(message: Record<string, unknown>): void;
    close(): Uint8Array;
  }

  export const Profile: {
    MesgNum: {
      FILE_ID: number;
      DEVICE_INFO: number;
      EVENT: number;
      RECORD: number;
      LAP: number;
      SESSION: number;
      ACTIVITY: number;
      DEVELOPER_DATA_ID: number;
      FIELD_DESCRIPTION: number;
      [key: string]: number;
    };
    types: {
      mesgNum: Record<number, string>;
      [key: string]: Record<number | string, string | number>;
    };
  };

  export const Utils: {
    FIT_EPOCH_MS: number;
    FitBaseType: {
      FLOAT32: number;
      UINT8: number;
      [key: string]: number;
    };
    convertDateToDateTime(date: Date): number;
    convertDateTimeToDate(dateTime: number): Date;
  };

  export class Decoder {
    constructor(stream: Stream);
    static isFIT(stream: Stream): boolean;
    isFIT(): boolean;
    checkIntegrity(): boolean;
    read(options?: Record<string, unknown>): {
      messages: Record<string, unknown[]>;
      errors: unknown[];
    };
  }

  export class Stream {
    static fromByteArray(bytes: number[]): Stream;
    static fromArrayBuffer(buffer: ArrayBuffer): Stream;
    static fromBuffer(buffer: Buffer): Stream;
  }
}
