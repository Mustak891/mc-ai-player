export type SubtitleCue = {
    startMs: number;
    endMs: number;
    text: string;
};

const parseTimePart = (value: string) => {
    const normalized = value.trim().replace(',', '.');
    const [hh = '0', mm = '0', ssMs = '0'] = normalized.split(':');
    const [ss = '0', msRaw = '0'] = ssMs.split('.');
    const ms = msRaw.padEnd(3, '0').slice(0, 3);
    return Number(hh) * 3600000 + Number(mm) * 60000 + Number(ss) * 1000 + Number(ms);
};

const decodeSubtitleText = (value: string) =>
    value
        .replace(/<[^>]+>/g, '')
        .replace(/\{\\.*?\}/g, '')
        .trim();

export const parseSrt = (content: string): SubtitleCue[] => {
    const blocks = content.split(/\r?\n\r?\n/);
    const cues: SubtitleCue[] = [];

    for (const block of blocks) {
        const lines = block
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (lines.length < 2) continue;

        const timeLine = lines.find((line) => line.includes('-->'));
        if (!timeLine) continue;

        const [startRaw, endRaw] = timeLine.split('-->');
        if (!startRaw || !endRaw) continue;

        const startMs = parseTimePart(startRaw);
        const endMs = parseTimePart(endRaw.split(' ')[0] || endRaw);
        const payloadStart = lines.indexOf(timeLine) + 1;
        const text = decodeSubtitleText(lines.slice(payloadStart).join('\n'));
        if (!text || endMs <= startMs) continue;
        cues.push({ startMs, endMs, text });
    }

    return cues.sort((a, b) => a.startMs - b.startMs);
};

export const parseVtt = (content: string): SubtitleCue[] => {
    const normalized = content.replace(/^WEBVTT\s*/i, '').trim();
    return parseSrt(normalized);
};

export const getSubtitleTextAt = (cues: SubtitleCue[], positionMs: number) => {
    const cue = cues.find((item) => positionMs >= item.startMs && positionMs <= item.endMs);
    return cue?.text ?? '';
};

