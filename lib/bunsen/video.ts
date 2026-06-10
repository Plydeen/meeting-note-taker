import "server-only";

import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import ffmpegPath from "ffmpeg-static";

import { env, requireEnv } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const execFileAsync = promisify(execFile);

type RecallBotDetail = {
  recordings?: Array<{
    media_shortcuts?: {
      video_mixed?: {
        data?: { download_url?: string | null } | null;
      } | null;
    } | null;
  }>;
};

async function runFfmpeg(args: string[]) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not found");
  }
  await execFileAsync(ffmpegPath, args);
}

export async function extractMeetingKeyframes(meetingId: string): Promise<string[]> {
  try {
    const supabase = createSupabaseAdmin();
    const { data: bots, error } = await supabase.from("recall_bots").select("recall_bot_id").eq("meeting_id", meetingId);

    if (error) {
      throw error;
    }

    const maxFrames = env.BUNSEN_MAX_KEYFRAMES;
    let downloadUrl: string | null = null;

    for (const bot of bots ?? []) {
      const response = await fetch(`https://${env.RECALLAI_REGION}.recall.ai/api/v1/bot/${bot.recall_bot_id}/`, {
        headers: {
          authorization: requireEnv("RECALLAI_API_KEY"),
          accept: "application/json",
        },
      });

      if (!response.ok) {
        continue;
      }

      const detail = (await response.json()) as RecallBotDetail;
      for (const recording of detail.recordings ?? []) {
        const url = recording.media_shortcuts?.video_mixed?.data?.download_url;
        if (url) {
          downloadUrl = url;
          break;
        }
      }

      if (downloadUrl) {
        break;
      }
    }

    if (!downloadUrl || !ffmpegPath) {
      return [];
    }

    const workDir = await mkdtemp(join(tmpdir(), "bunsen-keyframes-"));
    const videoPath = join(workDir, "meeting.mp4");
    const framePattern = join(workDir, "frame_%02d.jpg");

    try {
      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok || !videoResponse.body) {
        return [];
      }

      await pipeline(
        Readable.fromWeb(videoResponse.body as import("node:stream/web").ReadableStream),
        createWriteStream(videoPath),
      );

      try {
        await runFfmpeg([
          "-i",
          videoPath,
          "-vf",
          "select='gt(scene,0.25)',scale=1024:-2",
          "-vsync",
          "vfr",
          "-frames:v",
          String(maxFrames),
          "-q:v",
          "5",
          framePattern,
        ]);
      } catch {
        await runFfmpeg([
          "-i",
          videoPath,
          "-vf",
          "fps=1/120,scale=1024:-2",
          "-frames:v",
          String(maxFrames),
          "-q:v",
          "5",
          framePattern,
        ]);
      }

      let files = (await readdir(workDir))
        .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
        .sort();

      if (files.length < 3) {
        for (const f of files) {
          await rm(join(workDir, f), { force: true });
        }
        await runFfmpeg([
          "-i",
          videoPath,
          "-vf",
          "fps=1/120,scale=1024:-2",
          "-frames:v",
          String(maxFrames),
          "-q:v",
          "5",
          framePattern,
        ]);
        files = (await readdir(workDir))
          .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
          .sort();
      }

      const dataUrls: string[] = [];
      for (const file of files.slice(0, maxFrames)) {
        const buffer = await readFile(join(workDir, file));
        dataUrls.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
      }

      return dataUrls;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn("[bunsen video] keyframe extraction failed", error);
    return [];
  }
}
