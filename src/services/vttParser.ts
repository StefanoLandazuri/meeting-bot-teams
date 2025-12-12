import webvtt from 'node-webvtt';

export interface VTTCue {
  start: number;
  end: number;
  text: string;
  identifier?: string;
}

export interface ParsedVTT {
  cues: VTTCue[];
  fullTranscript: string;
  duration: number;
  speakers: string[];
}

export class VTTParser {
  /**
   * Parsea un archivo VTT y extrae el texto
   */
  static parse(vttContent: string): ParsedVTT {
    try {
      const parsed = webvtt.parse(vttContent);
      
      const cues: VTTCue[] = parsed.cues.map(cue => ({
        start: cue.start,
        end: cue.end,
        text: cue.text,
        identifier: cue.identifier,
      }));

      // Extrae el texto completo
      const fullTranscript = cues
        .map(cue => cue.text)
        .join(' ')
        .replace(/<[^>]*>/g, '') // Remueve tags HTML si existen
        .replace(/\s+/g, ' ') // Normaliza espacios
        .trim();

      // Calcula duración
      const duration = cues.length > 0 ? cues[cues.length - 1].end : 0;

      // Extrae speakers si están en el formato "Speaker: texto"
      const speakers = Array.from(
        new Set(
          cues
            .map(cue => {
              const match = cue.text.match(/^([^:]+):/);
              return match ? match[1].trim() : null;
            })
            .filter(Boolean)
        )
      ) as string[];

      return {
        cues,
        fullTranscript,
        duration,
        speakers,
      };
    } catch (error: any) {
      throw new Error(`Failed to parse VTT: ${error.message}`);
    }
  }

  /**
   * Formatea el transcript con timestamps y speakers
   */
  static formatWithTimestamps(vttContent: string): string {
    const parsed = this.parse(vttContent);
    
    return parsed.cues
      .map(cue => {
        const timestamp = this.formatTime(cue.start);
        return `[${timestamp}] ${cue.text}`;
      })
      .join('\n');
  }

  /**
   * Formatea segundos a HH:MM:SS
   */
  private static formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Extrae solo el texto de speakers específicos
   */
  static filterBySpeaker(vttContent: string, speakerName: string): string {
    const parsed = this.parse(vttContent);
    
    return parsed.cues
      .filter(cue => cue.text.startsWith(`${speakerName}:`))
      .map(cue => cue.text.replace(`${speakerName}:`, '').trim())
      .join(' ');
  }
}