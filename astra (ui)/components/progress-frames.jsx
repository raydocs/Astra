;(function(){
const {
  AstraMark, AstraWordmark,
  IconLanguages, IconClose, IconCheck, IconPause, IconClock, IconArrowRight,
  IconGlobe, IconBookmark, IconBook,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   1. Translation Progress / Loading frame
   In-page progress pill + paragraph skeletons + cancel
   ==================================================================== */

const SkeletonLine = ({ w = "100%", h = 12, dim = 0.18 }) => (
  <div style={{
    height: h,
    width: w,
    borderRadius: 3,
    background: `color-mix(in srgb, var(--ink-1) ${dim * 100}%, transparent)`,
    marginBottom: 8,
  }} />
);

const ProgressPill = ({ done = 14, total = 38 }) => {
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{
      position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
      display: "inline-flex", alignItems: "center", gap: 12,
      padding: "8px 10px 8px 14px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-1)",
      borderRadius: 999,
      boxShadow: "var(--shadow-md)",
      fontFamily: "var(--font-sans)", fontSize: 13,
      color: "var(--ink-1)",
    }}>
      <AstraMark size={14} />
      <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)" }}>
        Translating…
      </span>
      <span style={{ width: 120, height: 3, background: "var(--bg-sunken)", borderRadius: 2, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--accent)" }} />
      </span>
      <span className="mono" style={{ color: "var(--ink-3)" }}>{done}/{total}</span>
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "transparent", border: "1px solid var(--line-2)",
        padding: "3px 8px", borderRadius: 999,
        color: "var(--ink-2)", fontSize: 12,
        fontFamily: "var(--font-sans)", cursor: "pointer",
      }}>
        <IconPause size={11} /> Pause
      </button>
      <button style={{
        background: "transparent", border: 0, color: "var(--ink-3)",
        cursor: "pointer", padding: 4, display: "inline-flex",
      }}>
        <IconClose size={13} />
      </button>
    </div>
  );
};

const ProgressFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    position: "relative", padding: "64px 80px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <ProgressPill done={14} total={38} />

    <div style={{ maxWidth: 700, margin: "0 auto", paddingTop: 24 }}>
      {/* Title — already translated */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: 36, lineHeight: 1.15,
          letterSpacing: "-0.025em", margin: 0, color: "var(--ink-1)",
          fontWeight: 400,
        }}>
          The Quiet Architecture of Reading
        </h1>
        <div style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 22, color: "var(--ink-2)", marginTop: 6,
          paddingLeft: 14, borderLeft: "2px solid var(--accent)",
          lineHeight: 1.4,
        }}>
          阅读的安静建筑
        </div>
      </div>

      {/* Done paragraph */}
      <p style={{
        fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.65,
        color: "var(--ink-1)", marginTop: 0, marginBottom: 6,
      }}>
        For most of human history, reading was a private architecture — a
        quiet room a person built between the lines on a page.
      </p>
      <p style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16,
        color: "var(--ink-2)", paddingLeft: 14, borderLeft: "2px solid var(--accent)",
        marginTop: 0, marginBottom: 24, lineHeight: 1.55,
      }}>
        在人类历史的大部分时间里，阅读是一种私人的建筑——一个人在页面字里行间之中建起的安静房间。
      </p>

      {/* In-flight paragraph (streaming) */}
      <p style={{
        fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.65,
        color: "var(--ink-1)", marginTop: 0, marginBottom: 6,
      }}>
        The room held only the reader and the writer's voice, suspended for
        the duration of a sentence.
      </p>
      <div style={{
        paddingLeft: 14, borderLeft: "2px solid var(--accent)",
        marginBottom: 24,
      }}>
        <span style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16,
          color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          房间里只有读者和作者的声音，悬停在一句话的时长之内
        </span>
        <span style={{
          display: "inline-block", width: 8, height: 16,
          background: "var(--accent)", marginLeft: 2, marginBottom: -3,
          animation: "astra-blink 1s steps(2) infinite",
        }} />
      </div>
      <style>{`@keyframes astra-blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }`}</style>

      {/* Skeleton paragraphs (queued) */}
      <p style={{
        fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.65,
        color: "var(--ink-1)", marginTop: 0, marginBottom: 6,
      }}>
        Today, that quiet has competition. The text of a website arrives
        embedded in chrome, surrounded by movement, interrupted by demand.
      </p>
      <div style={{ paddingLeft: 14, borderLeft: "2px dashed var(--line-2)", marginBottom: 24, paddingTop: 4, paddingBottom: 4 }}>
        <SkeletonLine w="92%" />
        <SkeletonLine w="86%" />
        <SkeletonLine w="40%" dim={0.12} />
      </div>

      <p style={{
        fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.65,
        color: "var(--ink-1)", marginTop: 0, marginBottom: 6,
      }}>
        Astra is an attempt to give a reader back the room — a quiet
        marginal voice, never overpainting the host page.
      </p>
      <div style={{ paddingLeft: 14, borderLeft: "2px dashed var(--line-2)", paddingTop: 4, paddingBottom: 4 }}>
        <SkeletonLine w="88%" />
        <SkeletonLine w="72%" dim={0.12} />
      </div>
    </div>
  </div>
);

Object.assign(window, { ProgressFrame });
})();
