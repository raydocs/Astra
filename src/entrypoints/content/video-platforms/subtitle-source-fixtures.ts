export const YOUTUBE_JSON3_FIXTURE = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 1200, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
    { tStartMs: 1200, dDurationMs: 900, segs: [{ utf8: "<i>Next</i> cue" }] },
  ],
})

export const YOUTUBE_XML_FIXTURE = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="0" dur="1.2">Hello &amp;amp; world</text>
  <text start="1.2" dur="0.9">Second cue</text>
</transcript>`

export const BILIBILI_JSON_FIXTURE = JSON.stringify({
  body: [
    { from: 0, to: 1.5, content: "你好 <b>世界</b>" },
    { from: 1.5, to: 3, content: "第二句" },
  ],
})
