/**
 * Streaming ZIP writer (fflate) — one file at a time, pulled by the HTTP response, so a large export
 * never sits in memory twice. Text is deflated; media/fonts (already compressed) are stored as is.
 * Node / edge / browser compatible (Web Streams only).
 */
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

export interface ZipEntry {
  /** path inside the archive, forward slashes ("public_html/assets/img/…") */
  path: string;
  /** deflate (text) or store (media, fonts, PNG) */
  compress: boolean;
  /** the file bytes; null skips the entry (e.g. a media file deleted since the render) */
  load(): Promise<Uint8Array | null>;
}

export interface ZipStreamOptions {
  /** modification time written for every entry */
  mtime: Date;
  /** the archive was fully produced (total bytes) */
  onDone?(bytes: number): void;
  /** the archive failed or the consumer went away before the end */
  onAbort?(reason: unknown): void;
}

const SAFE_PATH = /^(?:[A-Za-z0-9._@-]+\/)*[A-Za-z0-9._@-]+$/;

/** Entry paths come from our own builders; refuse anything that could escape the archive root. */
export function assertZipPath(path: string): string {
  if (!SAFE_PATH.test(path) || path.split("/").some((p) => p === "." || p === "..")) {
    throw new Error(`unsafe zip entry path: ${JSON.stringify(path)}`);
  }
  return path;
}

export function zipStream(entries: readonly ZipEntry[], opts: ZipStreamOptions): ReadableStream<Uint8Array> {
  for (const e of entries) assertZipPath(e.path);
  let zip: Zip | null = null;
  let next = 0;
  let total = 0;
  let ended = false;
  let finished = false;
  let failure: unknown = null;
  let queue: Uint8Array[] = [];

  return new ReadableStream<Uint8Array>({
    start() {
      zip = new Zip((err, chunk, final) => {
        if (err) {
          failure = err;
          return;
        }
        if (chunk.length) {
          queue.push(chunk);
          total += chunk.length;
        }
        if (final) finished = true;
      });
    },
    async pull(controller) {
      try {
        // produce until there is something to hand out (one file per round keeps memory flat)
        while (!queue.length && !finished) {
          if (next < entries.length) {
            const entry = entries[next++]!;
            const data = await entry.load();
            if (!data) continue;
            const file = entry.compress ? new ZipDeflate(entry.path, { level: 6 }) : new ZipPassThrough(entry.path);
            file.mtime = opts.mtime;
            zip!.add(file);
            file.push(data, true);
          } else if (!ended) {
            ended = true;
            zip!.end();
          } else {
            throw new Error("zip stream ended without its final chunk");
          }
          if (failure) throw failure;
        }
        for (const chunk of queue) controller.enqueue(chunk);
        queue = [];
        if (finished) {
          controller.close();
          opts.onDone?.(total);
        }
      } catch (err) {
        zip?.terminate();
        controller.error(err);
        opts.onAbort?.(err);
      }
    },
    cancel(reason) {
      zip?.terminate();
      opts.onAbort?.(reason ?? new Error("download cancelled"));
    },
  });
}

/** Whole stream → one buffer (scripts and tests). */
export async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
