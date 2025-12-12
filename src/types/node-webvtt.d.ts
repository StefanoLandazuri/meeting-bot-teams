// src/types/node-webvtt.d.ts
declare module 'node-webvtt' {
  export interface WebVTTCue {
    identifier: string;
    start: number;
    end: number;
    text: string;
    styles: string;
  }

  export interface WebVTTParsed {
    valid: boolean;
    strict: boolean;
    cues: WebVTTCue[];
    errors: any[];
  }

  export interface WebVTTSerializer {
    (input: WebVTTParsed): string;
  }

  export interface WebVTTParser {
    (input: string, options?: { strict?: boolean }): WebVTTParsed;
  }

  export interface WebVTTSegmenter {
    (input: string): string[];
  }

  export const parse: WebVTTParser;
  export const compile: WebVTTSerializer;
  export const segment: WebVTTSegmenter;
}