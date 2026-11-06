import styles from "./CakeLoader.module.css";

/**
 * Request-driven loaders. Progress is indeterminate: no invented percentages.
 * Keep accessibility copy as real text; animated artwork is decorative.
 */
export default function CakeLoader({ size = "large", variant = "cake", fullScreen = false, inline = false, label = "Loading Cake Galaxy…" }) {
  const dimension = ["small", "medium", "large"].includes(size) ? size : "large";
  const kind = ["cake", "logo", "spinner", "dots", "pulse", "progress"].includes(variant) ? variant : "cake";
  const Root = inline ? "span" : "div";
  return (
    <Root
      className={[styles.root, styles[dimension], styles[kind], fullScreen ? styles.fullScreen : "", inline ? styles.inline : ""].filter(Boolean).join(" ")}
      role={kind === "progress" ? "progressbar" : "status"}
      aria-live="polite"
      aria-label={label}
      data-cake-loader={dimension}
      data-loader-variant={kind}
    >
      {(kind === "cake" || kind === "logo") && <img
        className={styles.art}
        src={kind === "logo" ? "/images/cake-galaxy-sage-logo.webp" : "/images/loaders/cake-galaxy-outline-loader.svg"}
        alt=""
        width="320"
        height="320"
        decoding="async"
      />}
      {kind === "spinner" && <span className={styles.spinnerArt} aria-hidden="true" />}
      {kind === "dots" && <span className={styles.dotsArt} aria-hidden="true"><i/><i/><i/></span>}
      {kind === "pulse" && <span className={styles.pulseArt} aria-hidden="true" />}
      {kind === "progress" && <span className={styles.track} aria-hidden="true"><span/></span>}
      <span className={styles.label}>{label}</span>
    </Root>
  );
}

/** Fits inside a native button, inheriting its colour and accessible name. */
export function ButtonContent({ busy, pendingLabel = "Please wait…", children }) {
  return <span className={styles.buttonContent}>
    {busy && <span className={styles.spinnerArt} aria-hidden="true"/>}
    <span>{busy ? pendingLabel : children}</span>
  </span>;
}
